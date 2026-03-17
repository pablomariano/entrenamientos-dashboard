"""
Script de diagnóstico para analizar sesiones y detectar problemas de parsing.
Investiga por qué hay pocas muestras de HR y si hay datos de laps en sesiones sin GPS.
"""

import sys
import json
from datetime import datetime
from pathlib import Path
from collections import namedtuple

sys.path.insert(0, r'C:\Users\Pablo\AppData\Local\Programs\Python\Python314\Lib\site-packages')

import pytz
import tzlocal
import polar_rcx5_datalink.utils as utils
from polar_rcx5_datalink.datalink import DataLink
from polar_rcx5_datalink.parser import TrainingSession, HRType, SampleFields, Sample
from polar_rcx5_datalink.exceptions import SyncError
from polar_rcx5_datalink.utils import bcd_to_int

# Parche de compatibilidad tzlocal >= 3.0
def _datetime_to_utc_fixed(dt, timezone=None):
    if timezone is None:
        tz = pytz.timezone(str(tzlocal.get_localzone()))
    else:
        tz = pytz.timezone(timezone)
    return tz.localize(dt, is_dst=None).astimezone(pytz.utc)

utils.datetime_to_utc = _datetime_to_utc_fixed

def _safe_calculate_distance(self, coord1, coord2):
    try:
        lat1, lon1 = coord1
        lat2, lon2 = coord2
        if (lat1 is None or lon1 is None or lat2 is None or lon2 is None
                or abs(lat1) > 90 or abs(lon1) > 180
                or abs(lat2) > 90 or abs(lon2) > 180):
            return 0.0
        import geopy.distance
        return geopy.distance.distance(coord1, coord2).meters
    except Exception:
        return 0.0

TrainingSession._calculate_distance = _safe_calculate_distance

HR_MIN_VALID = 30
HR_MAX_VALID = 250
LAP_DATA_BITS = 416


def _hr_valido(hr):
    return hr is not None and HR_MIN_VALID <= hr <= HR_MAX_VALID


def analizar_stream_nogps(sess):
    """
    Analiza el stream de bits de una sesión sin GPS para detectar posibles
    bloques de lap data intercalados entre las muestras de HR.

    Retorna un dict con estadísticas y la lista de laps detectados.
    """
    bits = sess._samples_bits
    total_bits = len(bits)
    duration = sess.duration
    sample_rate = sess.info.get('sample_rate', 5)
    expected_samples = duration // sample_rate

    # --- Simulación del parser normal para ver dónde se detiene ---
    cursor = 0
    parsed_ok = 0
    parsed_invalid = 0
    invalid_runs = []   # secuencias consecutivas de HR inválido
    current_invalid_run = 0
    current_invalid_start = 0

    # Estado de parsing de HR (igual que la librería)
    zero_delta_counter = 0
    last_hr = None

    def parse_hr_bits(bits_str, last_hr, zero_delta_ctr):
        """Retorna (hr_value, bits_consumed, nuevo_zero_delta_ctr)"""
        if len(bits_str) < 2:
            return None, 0, zero_delta_ctr

        prefix2 = bits_str[:2]

        if prefix2 == '01':   # FULL_WITH_PREFIX: 11 bits, valor en [3:11]
            if len(bits_str) < 11:
                return None, 0, zero_delta_ctr
            val = int(bits_str[3:11], 2)
            return val, 11, 0

        elif prefix2 == '00':  # FULL_PREFIXLESS: 11 bits, valor en [0:11]
            if len(bits_str) < 11:
                return None, 0, zero_delta_ctr
            val = int(bits_str[0:11], 2)
            return val, 11, 0

        elif prefix2 == '10':  # POS_DELTA: 6 bits
            if len(bits_str) < 6:
                return None, 0, zero_delta_ctr
            delta = int(bits_str[2:6], 2)
            hr = (last_hr or 0) + delta
            new_ctr = zero_delta_ctr + 1 if delta == 0 else 0
            return hr, 6, new_ctr

        elif prefix2 == '11':  # NEG_DELTA: 6 bits (complemento a 2)
            if len(bits_str) < 6:
                return None, 0, zero_delta_ctr
            raw = bits_str[2:6]
            invertor = 0b1111
            delta = -((int(raw, 2) ^ invertor) + 1)
            hr = (last_hr or 0) + delta
            new_ctr = zero_delta_ctr + 1 if delta == 0 else 0
            return hr, 6, new_ctr

        return None, 0, zero_delta_ctr

    # Parsear primera muestra (inicio del stream)
    if sess.has_hr:
        hr, consumed, zero_delta_counter = parse_hr_bits(bits[cursor:], None, 0)
        if hr is not None:
            cursor += consumed
            last_hr = hr
            if _hr_valido(hr):
                parsed_ok += 1
            else:
                parsed_invalid += 1

    # Parsear el resto
    consecutive_invalid = 0
    lap_candidates = []

    while cursor < total_bits - 6:
        hr, consumed, zero_delta_counter = parse_hr_bits(
            bits[cursor:], last_hr, zero_delta_counter
        )

        if hr is None or consumed == 0:
            break

        if _hr_valido(hr):
            parsed_ok += 1
            last_hr = hr
            cursor += consumed
            if consecutive_invalid >= 5:
                lap_candidates.append({
                    'bit_start': cursor - consumed,
                    'consecutive_invalid_before': consecutive_invalid
                })
            consecutive_invalid = 0
        else:
            consecutive_invalid += 1
            last_hr = hr
            cursor += consumed
            parsed_invalid += 1

    return {
        'total_bits': total_bits,
        'expected_samples': expected_samples,
        'parsed_valid_hr': parsed_ok,
        'parsed_invalid_hr': parsed_invalid,
        'lap_candidates': lap_candidates,
        'bits_per_expected_sample': total_bits / expected_samples if expected_samples > 0 else 0,
    }


def parse_nogps_con_laps(sess):
    """
    Parser mejorado para sesiones sin GPS que detecta y saltea bloques de lap data.

    Estrategia: cuando se encuentran muchos valores de HR inválidos consecutivos
    (señal de que el cursor cayó en datos de lap), se intenta saltar LAP_DATA_BITS
    y continuar el parsing.
    """
    bits = sess._samples_bits
    sample_rate = sess.info.get('sample_rate', 5)
    samples = []
    laps = []
    cursor = 0
    last_hr = None
    zero_delta_ctr = 0
    lap_number = 0

    def read_hr(pos, prev_hr, zd_ctr):
        segment = bits[pos:]
        if len(segment) < 6:
            return None, 0, zd_ctr

        p = segment[:2]
        if p == '01':
            if len(segment) < 11:
                return None, 0, zd_ctr
            return int(segment[3:11], 2), 11, 0
        elif p == '00':
            if len(segment) < 11:
                return None, 0, zd_ctr
            return int(segment[0:11], 2), 11, 0
        elif p == '10':
            delta = int(segment[2:6], 2)
            hr = (prev_hr or 0) + delta
            return hr, 6, (zd_ctr + 1 if delta == 0 else 0)
        elif p == '11':
            raw = segment[2:6]
            delta = -((int(raw, 2) ^ 0b1111) + 1)
            hr = (prev_hr or 0) + delta
            return hr, 6, (zd_ctr + 1 if delta == 0 else 0)

        return None, 0, zd_ctr

    # Primera muestra
    if sess.has_hr:
        hr, consumed, zero_delta_ctr = read_hr(cursor, None, 0)
        if hr is not None:
            cursor += consumed
            last_hr = hr
            samples.append(Sample(hr if _hr_valido(hr) else None))

    invalid_streak = 0
    INVALID_THRESHOLD = 8  # Si hay 8+ HR inválidos seguidos, sospechamos lap data

    while cursor < len(bits) - 6 and len(bits[cursor:cursor+7]) > 5:
        hr, consumed, zero_delta_ctr = read_hr(cursor, last_hr, zero_delta_ctr)

        if hr is None or consumed == 0:
            break

        if _hr_valido(hr):
            invalid_streak = 0
            last_hr = hr
            cursor += consumed
            samples.append(Sample(hr))
        else:
            invalid_streak += 1
            if invalid_streak >= INVALID_THRESHOLD:
                # Posible bloque de lap data: retroceder al inicio del streak
                # y saltar LAP_DATA_BITS
                cursor_lap_start = cursor - (invalid_streak - 1) * 6
                cursor = cursor_lap_start + LAP_DATA_BITS

                # Registrar el lap detectado
                lap_number += 1
                tiempo_aprox = len(samples) * sample_rate
                laps.append({
                    'lap_number': lap_number,
                    'sample_at': len(samples),
                    'time_seconds': tiempo_aprox,
                    'time_formatted': f"{tiempo_aprox // 60:02d}:{tiempo_aprox % 60:02d}",
                    'bit_position': cursor_lap_start,
                })

                invalid_streak = 0
                zero_delta_ctr = 0
                last_hr = None
            else:
                last_hr = hr
                cursor += consumed
                samples.append(Sample(None))  # Muestra inválida → None

    return samples, laps


def diagnosticar_sesion(i, raw_session):
    print(f"\n{'─'*70}")
    print(f"  SESIÓN {i}")
    print(f"{'─'*70}")

    try:
        sess = TrainingSession(raw_session)
    except Exception as e:
        print(f"  ✗ No se pudo crear TrainingSession: {e}")
        return

    sr = sess.info.get('sample_rate', 5)
    dur = sess.duration
    expected = dur // sr

    print(f"  Fecha:          {sess.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Duración:       {dur // 3600:02d}:{(dur % 3600)//60:02d}:{dur % 60:02d}  ({dur}s)")
    print(f"  Tasa de muestra:{sr}s")
    print(f"  Muestras esp.:  {expected}")
    sample_bits = len(sess._samples_bits)
    # Para GPS el header ocupa 349 bytes; para no-GPS, 351. Los bits ya vienen descontados.
    # Calculamos cuántos samples caben en los bits disponibles (estimación conservadora).
    bits_por_sample_gps = 45   # promedio empírico para GPS (variable según encoding)
    bits_por_sample_nogps = 8  # promedio para no-GPS (solo HR delta)
    bits_ref = bits_por_sample_gps if sess.has_gps else bits_por_sample_nogps
    datos_disponibles_pct = min(100, round(sample_bits / max(1, expected * bits_ref) * 100))

    print(f"  Tiene HR:       {sess.has_hr}")
    print(f"  Tiene GPS:      {sess.has_gps}")
    print(f"  Bits de samples:{sample_bits}  (~{datos_disponibles_pct}% de los datos esperados)")

    if not sess.has_hr:
        print("  (Sin HR, nada que parsear)")
        return

    # Forzar modo no-GPS (el byte 166 queda en True aunque el reloj no tenga GPS)
    if sess.has_gps:
        sess.has_gps = False
        sess._samples_bits = sess._get_samples_bits()
        sample_bits = len(sess._samples_bits)
        print(f"  ⚠ GPS forzado a False — nuevo bits de samples: {sample_bits}")

    # --- Parser estándar ---
    try:
        sess.parse_samples()
        std_valid = sum(1 for s in sess.samples if _hr_valido(s.hr))
        std_total = len(sess.samples)
        cobertura = round(std_total / expected * 100) if expected > 0 else 0
        print(f"\n  [Parser estándar]")
        print(f"  Muestras obtenidas: {std_total}/{expected}  ({cobertura}%)  |  HR válido: {std_valid}")
        if std_total > 0:
            hrs = [s.hr for s in sess.samples if _hr_valido(s.hr)]
            if hrs:
                print(f"  HR: min={min(hrs)}  avg={sum(hrs)//len(hrs)}  max={max(hrs)}")
    except Exception as e:
        print(f"\n  [Parser estándar] FALLÓ: {e}")
        std_total = 0

    # --- Solo para sesiones sin GPS ---
    if not sess.has_gps:
        # Análisis del stream
        stats = analizar_stream_nogps(sess)
        print(f"\n  [Análisis del stream (sin GPS)]")
        print(f"  Bits disponibles:      {stats['total_bits']}")
        print(f"  Bits/muestra esperado: {stats['bits_per_expected_sample']:.1f}")
        print(f"  HR válidos parseados:  {stats['parsed_valid_hr']}")
        print(f"  HR inválidos:          {stats['parsed_invalid_hr']}")
        if stats['lap_candidates']:
            print(f"  Posibles laps en bits: {[c['bit_start'] for c in stats['lap_candidates']]}")

        # Parser mejorado con detección de laps
        samples_ext, laps_ext = parse_nogps_con_laps(sess)
        valid_ext = sum(1 for s in samples_ext if _hr_valido(s.hr))
        print(f"\n  [Parser mejorado (con detección de laps)]")
        print(f"  Muestras totales: {len(samples_ext)}  |  Con HR válido: {valid_ext}")
        if laps_ext:
            print(f"  Laps detectados: {len(laps_ext)}")
            for lap in laps_ext:
                print(f"    Lap {lap['lap_number']}: en muestra {lap['sample_at']} "
                      f"({lap['time_formatted']})")
        else:
            print(f"  Sin laps detectados")

        hrs_ext = [s.hr for s in samples_ext if _hr_valido(s.hr)]
        if hrs_ext:
            print(f"  HR: min={min(hrs_ext)}  avg={sum(hrs_ext)//len(hrs_ext)}  max={max(hrs_ext)}")

        if valid_ext > std_total:
            print(f"\n  *** El parser mejorado encontró {valid_ext - std_total} muestras más ***")


def investigar_laps(raw_session, num_laps_conocidos):
    """
    Analiza en profundidad el binario de una sesión para identificar el formato
    de los bloques de lap. Requiere saber la cantidad real de laps de la sesión.
    """
    first_packet = raw_session[0]

    print(f"\n{'='*70}")
    print(f"  INVESTIGACIÓN DE LAPS  (laps reales: {num_laps_conocidos})")
    print(f"{'='*70}")

    # --- 1. Buscar en el header qué byte podría ser el conteo de laps ---
    print(f"\n[1] Bytes del header con valor == {num_laps_conocidos} (candidatos a conteo de laps):")
    # Bytes ya conocidos del protocolo (no son lap count)
    bytes_conocidos = {35,36,37,38,39,40,41,42,43,44,50,54,165,166,167,201,203,205,219}
    candidatos = [i for i, b in enumerate(first_packet) if b == num_laps_conocidos and i not in bytes_conocidos]
    if candidatos:
        for idx in candidatos:
            print(f"    Byte {idx:3d} = {num_laps_conocidos}")
    else:
        print(f"    Ningún byte desconocido tiene el valor {num_laps_conocidos}")

    # También mostrar bytes cercanos a los conocidos para dar contexto
    print(f"\n[2] Header bytes 195–220 (zona de estadísticas HR, posible zona de laps):")
    for i in range(195, min(221, len(first_packet))):
        marca = " ← CANDIDATO" if i in candidatos else ""
        print(f"    [{i:3d}] = {first_packet[i]:3d}  (0x{first_packet[i]:02X}){marca}")

    # --- 2. Analizar el stream de bits ---
    sess = TrainingSession(raw_session)
    if sess.has_gps:
        sess.has_gps = False
        sess._samples_bits = sess._get_samples_bits()

    bits = sess._samples_bits
    total_bits = len(bits)
    LAP_BITS = 416

    print(f"\n[3] Análisis del stream ({total_bits} bits disponibles)")
    print(f"    Si hay {num_laps_conocidos} laps, deberían existir {num_laps_conocidos} bloques de ~{LAP_BITS} bits intercalados.")

    # Buscar secuencias de bytes con bajo contenido de información (posibles separadores)
    # Un bloque de lap en no-GPS podría contener datos estructurados vs. HR delta
    # Buscamos ventanas donde la densidad de bits 1 es atípica (>70% o <30%)
    window = 48  # 6 bytes
    anomalias = []
    for pos in range(0, total_bits - window, 8):
        chunk = bits[pos:pos+window]
        ones = chunk.count('1')
        ratio = ones / window
        if ratio < 0.20 or ratio > 0.80:
            anomalias.append((pos, ratio, chunk))

    print(f"\n[4] Zonas con densidad de bits anómala (<20% o >80% de unos) — posibles marcadores de lap:")
    if anomalias:
        # Agrupar anomalías contiguas
        grupos = []
        grupo_actual = [anomalias[0]]
        for a in anomalias[1:]:
            if a[0] - grupo_actual[-1][0] <= window:
                grupo_actual.append(a)
            else:
                grupos.append(grupo_actual)
                grupo_actual = [a]
        grupos.append(grupo_actual)

        print(f"    Grupos detectados: {len(grupos)}")
        for g in grupos[:20]:
            inicio = g[0][0]
            fin = g[-1][0] + window
            long = fin - inicio
            ratio_prom = sum(x[1] for x in g) / len(g)
            print(f"    bits {inicio:6d}–{fin:6d}  ({long:4d} bits)  densidad={ratio_prom:.0%}")
    else:
        print("    No se encontraron zonas anómalas.")

    # --- 3. Mostrar los primeros bytes del stream en hex para inspección manual ---
    print(f"\n[5] Primeros 64 bytes del stream de samples (hex):")
    hex_bytes = []
    for i in range(0, min(512, total_bits - 7), 8):
        byte_val = int(bits[i:i+8], 2)
        hex_bytes.append(f"{byte_val:02X}")
    print("    " + " ".join(hex_bytes[:32]))
    if len(hex_bytes) > 32:
        print("    " + " ".join(hex_bytes[32:64]))

    print(f"\n[6] Últimos 32 bytes del stream de samples (hex):")
    hex_end = []
    start_end = max(0, total_bits - 256)
    for i in range(start_end, total_bits - 7, 8):
        byte_val = int(bits[i:i+8], 2)
        hex_end.append(f"{byte_val:02X}")
    print("    " + " ".join(hex_end[:32]))


def main():
    print("="*70)
    print("DIAGNÓSTICO DE SESIONES - Polar RCX5")
    print("="*70)
    print("\nModos disponibles:")
    print("  1 = Diagnóstico general de todas las sesiones")
    print("  2 = Investigar laps de la última sesión")
    modo = input("\nModo [1/2]: ").strip()

    input("\nPresiona ENTER cuando hayas seleccionado 'Connect > Start synchronizing' en tu reloj...")

    try:
        print("\nSincronizando...")
        with DataLink() as dl:
            dl.synchronize()
            raw_sessions = dl.sessions

        print(f"✓ {len(raw_sessions)} sesiones encontradas")

        if modo == '2':
            if not raw_sessions:
                print("No hay sesiones.")
            else:
                ultima = raw_sessions[-1]
                resp = input(f"\n¿Cuántos laps registraste en la última sesión? ").strip()
                try:
                    n = int(resp)
                except ValueError:
                    n = 1
                investigar_laps(ultima, n)
        else:
            for i, raw in enumerate(raw_sessions, 1):
                diagnosticar_sesion(i, raw)

        print(f"\n{'='*70}")
        print("Diagnóstico completado.")

    except SyncError as e:
        print(f"\n✗ Error de sincronización: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nCancelado.")
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ Error inesperado: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
