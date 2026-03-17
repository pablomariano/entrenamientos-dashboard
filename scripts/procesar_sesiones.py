"""
procesar_sesiones.py — Procesa sesiones raw y produce data/entrenamientos.json.

Carga data/raw_sessions.pkl (generado por descargar_raw.py), aplica los patches
necesarios y extrae duración, HR stats, muestras de HR, laps y TRIMP.

El formato de salida es compatible con el dashboard Next.js actual.

Uso:
    python scripts/procesar_sesiones.py
"""

import json
import math
import pickle
import sys
from datetime import datetime
from pathlib import Path

# Asegurarse de que scripts/ esté en el path para importar patches
sys.path.insert(0, str(Path(__file__).parent))

import patches
patches.apply_patches()

from polar_rcx5_datalink.parser import TrainingSession
from polar_rcx5_datalink.utils import bcd_to_int

DATA_DIR    = Path(__file__).parent.parent / "data"
RAW_PKL     = DATA_DIR / "raw_sessions.pkl"
OUTPUT_JSON = DATA_DIR / "entrenamientos.json"

# Rango fisiológico válido de frecuencia cardíaca (bpm)
HR_MIN_VALID = 30
HR_MAX_VALID = 250

# Detección de laps sin GPS: bloques de 416 bits con < 15% de bits en 1
LAP_DATA_BITS   = TrainingSession._LAP_DATA_BITS_LENGTH  # 416
LAP_DENSITY_MAX = 0.15


# ---------------------------------------------------------------------------
# Utilidades HR
# ---------------------------------------------------------------------------

def _hr_valido(hr):
    if hr is None:
        return False
    return HR_MIN_VALID <= hr <= HR_MAX_VALID


def calcular_trimp(hr_samples, user_max_hr, user_resting_hr, sample_rate_seconds=5):
    """TRIMP de Banister: Σ [ dur_min × FC_rel × e^(1.92 × FC_rel) ]"""
    if not hr_samples or user_max_hr is None or user_resting_hr is None:
        return None
    hr_range = user_max_hr - user_resting_hr
    if hr_range <= 0:
        return None

    duracion_min = sample_rate_seconds / 60.0
    acum = 0.0
    for s in hr_samples:
        hr = s.get("hr")
        if hr is None:
            continue
        fc_rel = max((hr - user_resting_hr) / hr_range, 0.0)
        acum += duracion_min * fc_rel * math.exp(1.92 * fc_rel)

    trimp = round(acum, 1)
    if trimp < 50:
        level, desc = "bajo", "Recuperación o salida suave. Buen día para descanso activo."
    elif trimp <= 120:
        level, desc = "medio", "Sesión de carga moderada. Adecuada para desarrollo aeróbico."
    else:
        level, desc = "alto", "Sesión exigente. Prevé descanso y alimentación adecuada."

    return {"trimp": trimp, "level": level, "description": desc}


# ---------------------------------------------------------------------------
# Detección de laps (sin GPS)
# ---------------------------------------------------------------------------

def detectar_laps_nogps(sess):
    """
    Escanea el stream de bits buscando bloques de lap (416 bits de baja densidad).

    Retorna (laps, laps_header, lap_bit_offsets).
    """
    bits        = sess._samples_bits
    sample_rate = sess.info.get("sample_rate", 5)
    cursor      = 0
    n_samples   = 0
    laps        = []
    lap_offsets = []

    def avanzar_muestra(pos):
        if pos + 6 > len(bits):
            return 0
        p = bits[pos:pos + 2]
        if p in ("01", "00"):
            return 11 if pos + 11 <= len(bits) else 0
        elif p in ("10", "11"):
            return 6 if pos + 6 <= len(bits) else 0
        return 0

    consumed = avanzar_muestra(cursor)
    if consumed:
        cursor += consumed
        n_samples = 1

    while cursor < len(bits) - 6:
        if cursor + LAP_DATA_BITS <= len(bits):
            chunk   = bits[cursor:cursor + LAP_DATA_BITS]
            density = chunk.count("1") / LAP_DATA_BITS
            if density < LAP_DENSITY_MAX:
                t = n_samples * sample_rate
                laps.append({
                    "lap_number":     len(laps) + 1,
                    "time_seconds":   t,
                    "time_formatted": f"{t//3600:02d}:{(t%3600)//60:02d}:{t%60:02d}",
                })
                lap_offsets.append(cursor)
                cursor += LAP_DATA_BITS
                continue

        consumed = avanzar_muestra(cursor)
        if not consumed:
            break
        cursor    += consumed
        n_samples += 1

    try:
        laps_header = sess.raw[0][161]
    except (IndexError, TypeError):
        laps_header = None

    return laps, laps_header, lap_offsets


# ---------------------------------------------------------------------------
# Parser custom de HR que salta bloques de lap
# ---------------------------------------------------------------------------

def _decodificar_hr_muestra(bits, pos, last_hr):
    """
    Decodifica una muestra HR desde la posición pos en el stream de bits.
    Replica el algoritmo de sess._process_hr_bits() de la librería.
    
    Retorna (hr_value, bits_consumed).
    """
    if pos + 6 > len(bits):
        return None, 0
    
    prefix = bits[pos:pos+2]
    
    # Full con prefijo '01': offset 3, lee bits[pos+3:pos+11] (8 bits)
    if prefix == '01':
        if pos + 11 > len(bits):
            return None, 0
        hr = int(bits[pos+3:pos+11], 2)
        return hr, 11
    
    # Full sin prefijo '00': offset 0, lee bits[pos+0:pos+11] (11 bits completos)
    elif prefix == '00':
        if pos + 11 > len(bits):
            return None, 0
        hr = int(bits[pos:pos+11], 2)
        return hr, 11
    
    # Delta positivo '10': 6 bits, delta en bits[pos+2:pos+6]
    elif prefix == '10':
        if pos + 6 > len(bits):
            return None, 0
        delta = int(bits[pos+2:pos+6], 2)
        hr = (last_hr or 0) + delta
        return hr, 6
    
    # Delta negativo '11': 6 bits, delta en complemento a 2
    elif prefix == '11':
        if pos + 6 > len(bits):
            return None, 0
        delta = -((int(bits[pos+2:pos+6], 2) ^ 0b1111) + 1)
        hr = (last_hr or 0) + delta
        return hr, 6
    
    return None, 0


def parsear_hr_custom(sess):
    """
    Parser de HR single-pass: detecta bloques de lap y parsea HR con el mismo
    cursor, garantizando que no hay desfase entre detección y parsing.

    Usa la misma lógica de frozen-fields que la librería (avanza 1 bit cuando
    el campo está congelado).
    """
    bits        = sess._samples_bits
    sample_rate = sess.info.get('sample_rate', 5)
    duration    = sess.duration
    max_samples = duration // sample_rate if duration and sample_rate else None

    cursor          = 0
    n_samples       = 0
    hr_values       = []
    last_hr         = None
    zero_delta_count = 0
    is_frozen        = False

    while cursor < len(bits) - 6:
        if max_samples is not None and n_samples >= max_samples:
            break

        # Detectar bloque de lap en la posición actual del cursor
        if cursor + LAP_DATA_BITS <= len(bits):
            chunk   = bits[cursor:cursor + LAP_DATA_BITS]
            density = chunk.count('1') / LAP_DATA_BITS
            if density < LAP_DENSITY_MAX:
                # Leer todos los bits del bloque manteniendo estado, descartar
                lap_end = cursor + LAP_DATA_BITS
                while cursor < lap_end:
                    if cursor + 2 > len(bits):
                        break
                    prefix = bits[cursor:cursor+2]
                    if is_frozen and prefix != '01':
                        cursor += 1
                    else:
                        hr, consumed = _decodificar_hr_muestra(bits, cursor, last_hr)
                        if not consumed:
                            break
                        # Mantener estado frozen
                        if prefix in ('10', '11'):
                            raw_delta = (hr or 0) - (last_hr or 0)
                            if raw_delta == 0:
                                zero_delta_count += 1
                                is_frozen = zero_delta_count >= 2
                            else:
                                zero_delta_count = 0
                                is_frozen = False
                        else:
                            zero_delta_count = 0
                            is_frozen = False
                        if hr is not None and _hr_valido(hr):
                            last_hr = hr
                        cursor += consumed
                        n_samples += 1
                        hr_values.append(None)  # descartar muestra de lap
                cursor = lap_end  # asegurar que superamos el bloque completo
                continue

        # Muestra HR normal
        if cursor + 2 > len(bits):
            break
        prefix = bits[cursor:cursor+2]

        if is_frozen and prefix != '01':
            hr       = last_hr
            consumed = 1
        else:
            hr, consumed = _decodificar_hr_muestra(bits, cursor, last_hr)
            if not consumed:
                break
            if prefix in ('10', '11'):
                raw_delta = (hr or 0) - (last_hr or 0)
                if raw_delta == 0:
                    zero_delta_count += 1
                    is_frozen = zero_delta_count >= 2
                else:
                    zero_delta_count = 0
                    is_frozen = False
            else:
                zero_delta_count = 0
                is_frozen = False

        cursor    += consumed
        n_samples += 1

        if hr is not None and _hr_valido(hr):
            hr_values.append(hr)
            last_hr = hr
        else:
            hr_values.append(None)

    return hr_values


# ---------------------------------------------------------------------------
# Extracción de información básica del header (fallback sin parser)
# ---------------------------------------------------------------------------

def extraer_info_basica(raw_session):
    """Extrae fecha, duración y HR stats directamente del header binario."""
    try:
        pkt = raw_session[0]
        year   = pkt[44] + 1920
        month  = pkt[43]
        day    = pkt[42]
        hour   = bcd_to_int(pkt[41])
        minute = bcd_to_int(pkt[40])
        second = bcd_to_int(pkt[39])

        dur_h = bcd_to_int(pkt[38])
        dur_m = bcd_to_int(pkt[37])
        dur_s = bcd_to_int(pkt[36])

        has_hr  = bool(pkt[165])
        hr_avg  = pkt[201] if has_hr else None
        hr_max  = pkt[205] if has_hr else None
        hr_min  = pkt[203] if has_hr else None

        start_time    = datetime(year, month, day, hour, minute, second)
        duration_total = dur_h * 3600 + dur_m * 60 + dur_s

        return {
            "start_time":         start_time.isoformat(),
            "duration_seconds":   duration_total,
            "duration_formatted": f"{dur_h:02d}:{dur_m:02d}:{dur_s:02d}",
            "has_hr":             has_hr,
            "hr_avg":             hr_avg,
            "hr_max":             hr_max,
            "hr_min":             hr_min,
        }
    except Exception as e:
        return {"error": str(e), "parseable": False}


# ---------------------------------------------------------------------------
# Procesamiento completo de una sesión
# ---------------------------------------------------------------------------

def parsear_sesion_completa(raw_session):
    """Extrae duración, HR stats, muestras de HR, laps y TRIMP de una sesión."""
    try:
        sess = TrainingSession(raw_session)

        # Forzar modo no-GPS: el byte 166 puede quedar en True aunque el reloj
        # no tenga GPS, causando que parse_samples() lea coordenadas donde solo
        # hay datos de HR.
        if sess.has_gps:
            sess.has_gps = False
            sess._samples_bits = sess._get_samples_bits()

        laps_detectados = []
        laps_header     = None
        muestras_hr     = []
        muestras_parseadas = False

        try:
            laps_detectados, laps_header, _ = detectar_laps_nogps(sess)
        except Exception:
            pass

        if sess.has_hr:
            try:
                # Usar parser custom que salta bloques de lap correctamente
                hr_values = parsear_hr_custom(sess)
                muestras_parseadas = True

                sample_rate = sess.info.get("sample_rate", 5)
                start_time  = sess.start_time

                for i, hr in enumerate(hr_values):
                    if hr is not None:
                        t = i * sample_rate
                        muestras_hr.append({
                            "timestamp":      start_time.timestamp() + t,
                            "time_seconds":   t,
                            "time_formatted": f"{t // 60:02d}:{t % 60:02d}",
                            "hr":             hr,
                        })
            except Exception:
                muestras_parseadas = False

        datos = {
            "id":                 sess.id,
            "start_time":         sess.start_time.isoformat(),
            "start_utctime":      sess.start_utctime.isoformat() if sess.start_utctime else None,
            "duration_seconds":   sess.duration,
            "duration_formatted": (
                f"{sess.duration // 3600:02d}:"
                f"{(sess.duration % 3600) // 60:02d}:"
                f"{sess.duration % 60:02d}"
            ),
            "has_hr": sess.has_hr,
        }

        if sess.has_hr:
            hr_avg = sess.info.get("hr_avg")
            hr_max = sess.info.get("hr_max")
            hr_min = sess.info.get("hr_min")
            datos["hr_avg"]               = hr_avg if _hr_valido(hr_avg) else None
            datos["hr_max"]               = hr_max if _hr_valido(hr_max) else None
            datos["hr_min"]               = hr_min if _hr_valido(hr_min) else None
            datos["sample_rate_seconds"]  = sess.info.get("sample_rate", 5)
            datos["user_hr_max"]          = sess.info.get("user_hr_max")
            datos["user_hr_rest"]         = sess.info.get("user_hr_rest")
        else:
            datos["hr_avg"] = datos["hr_max"] = datos["hr_min"] = None
            datos["sample_rate_seconds"] = datos["user_hr_max"] = datos["user_hr_rest"] = None

        if muestras_parseadas and muestras_hr:
            datos["hr_samples"]     = muestras_hr
            datos["num_hr_samples"] = len(muestras_hr)
        else:
            datos["hr_samples"]     = []
            datos["num_hr_samples"] = 0

        datos["laps"]     = laps_detectados
        datos["num_laps"] = len(laps_detectados)
        datos["has_laps"] = len(laps_detectados) > 0
        if laps_header is not None:
            datos["num_laps_header"] = laps_header

        if muestras_hr:
            user_max  = datos.get("user_hr_max") or datos.get("hr_max")
            user_rest = datos.get("user_hr_rest") or 60
            sr        = datos.get("sample_rate_seconds", 5)
            if user_max is not None and user_rest is not None and user_max > user_rest:
                datos["trimp"] = calcular_trimp(muestras_hr, user_max, user_rest, sr)
            else:
                datos["trimp"] = None
        else:
            datos["trimp"] = None

        return datos

    except Exception:
        datos_basicos = extraer_info_basica(raw_session)
        datos_basicos["laps"]     = []
        datos_basicos["num_laps"] = 0
        datos_basicos["has_laps"] = False
        datos_basicos["trimp"]    = None
        return datos_basicos


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 70)
    print("PROCESADOR DE SESIONES — Polar RCX5")
    print("=" * 70)

    if not RAW_PKL.exists():
        print(f"\n✗ No se encontró {RAW_PKL}")
        print("  Ejecutá primero: python scripts/descargar_raw.py")
        sys.exit(1)

    with open(RAW_PKL, "rb") as f:
        raw_sessions = pickle.load(f)

    print(f"\nCargadas {len(raw_sessions)} sesiones desde {RAW_PKL.name}")
    print("\nProcesando sesiones...")

    todas = []
    for i, raw_session in enumerate(raw_sessions, 1):
        print(f"  [{i:>3}/{len(raw_sessions)}] ", end="", flush=True)
        datos = parsear_sesion_completa(raw_session)
        todas.append(datos)
        fecha    = datos.get("start_time", "?")[:10]
        dur      = datos.get("duration_formatted", "?")
        hr_avg   = datos.get("hr_avg", "—")
        n_samp   = datos.get("num_hr_samples", 0)
        n_laps   = datos.get("num_laps", 0)
        trimp_v  = (datos.get("trimp") or {}).get("trimp", "—")
        print(f"{fecha}  dur={dur}  hr_avg={hr_avg}  samples={n_samp}  laps={n_laps}  TRIMP={trimp_v}")

    resultado = {
        "export_date":    datetime.now().isoformat(),
        "total_sessions": len(todas),
        "sessions":       todas,
    }

    DATA_DIR.mkdir(exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(resultado, f, indent=2, ensure_ascii=False)

    size_kb = OUTPUT_JSON.stat().st_size / 1024
    print(f"\n✓ {OUTPUT_JSON}  ({size_kb:.1f} KB)")

    sesiones_con_laps = sum(1 for s in todas if s.get("has_laps"))
    total_laps        = sum(s.get("num_laps", 0) for s in todas)
    sesiones_con_hr   = sum(1 for s in todas if s.get("num_hr_samples", 0) > 0)

    print()
    print("Resumen:")
    print(f"  Sesiones procesadas:     {len(todas)}")
    print(f"  Con muestras HR:         {sesiones_con_hr}")
    print(f"  Con laps detectados:     {sesiones_con_laps}  ({total_laps} laps en total)")
    print()
    print("=" * 70)


if __name__ == "__main__":
    main()
