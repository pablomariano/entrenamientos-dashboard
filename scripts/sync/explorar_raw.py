"""
explorar_raw.py — Exploración offline de sesiones raw (sin necesidad del reloj).

Carga data/raw_sessions.pkl y para cada sesión:
  1. Intenta parsear SIN patches → reporta sess.info o excepción
  2. Intenta parsear CON patches → ídem + intenta parse_samples()
  3. Lee header directamente por offsets conocidos → compara HR avg/max/min

Uso:
    python scripts/explorar_raw.py
    python scripts/explorar_raw.py --sesion 3   # analiza solo la sesión 3
"""

import argparse
import pickle
import sys
import traceback
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
RAW_PKL  = DATA_DIR / "raw_sessions.pkl"

# Offsets del header del protocolo RCX5 (en bytes, paquete 0)
OFFSET_SECOND        = 39
OFFSET_MINUTE        = 40
OFFSET_HOUR          = 41
OFFSET_DAY           = 42
OFFSET_MONTH         = 43
OFFSET_YEAR          = 44   # año - 1920
OFFSET_DUR_SECONDS   = 36
OFFSET_DUR_MINUTES   = 37
OFFSET_DUR_HOURS     = 38
OFFSET_HAS_HR        = 165
OFFSET_HAS_GPS       = 166
OFFSET_HR_MIN        = 203
OFFSET_HR_AVG        = 201
OFFSET_HR_MAX        = 205
OFFSET_LAPS_HEADER   = 161


def leer_header_directo(pkt):
    """Lee los campos de cabecera directamente por offset, sin usar el parser."""
    from polar_rcx5_datalink.utils import bcd_to_int
    try:
        year   = pkt[OFFSET_YEAR] + 1920
        month  = pkt[OFFSET_MONTH]
        day    = pkt[OFFSET_DAY]
        hour   = bcd_to_int(pkt[OFFSET_HOUR])
        minute = bcd_to_int(pkt[OFFSET_MINUTE])
        second = bcd_to_int(pkt[OFFSET_SECOND])
        dur_h  = bcd_to_int(pkt[OFFSET_DUR_HOURS])
        dur_m  = bcd_to_int(pkt[OFFSET_DUR_MINUTES])
        dur_s  = bcd_to_int(pkt[OFFSET_DUR_SECONDS])
        has_hr  = bool(pkt[OFFSET_HAS_HR])
        has_gps = bool(pkt[OFFSET_HAS_GPS])
        hr_avg  = pkt[OFFSET_HR_AVG] if has_hr else None
        hr_max  = pkt[OFFSET_HR_MAX] if has_hr else None
        hr_min  = pkt[OFFSET_HR_MIN] if has_hr else None
        laps_h  = pkt[OFFSET_LAPS_HEADER]
        return {
            "start":    f"{year}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}:{second:02d}",
            "duration": f"{dur_h:02d}:{dur_m:02d}:{dur_s:02d}",
            "has_hr":   has_hr,
            "has_gps":  has_gps,
            "hr_avg":   hr_avg,
            "hr_max":   hr_max,
            "hr_min":   hr_min,
            "laps_hdr": laps_h,
        }
    except Exception as e:
        return {"error": str(e)}


def intentar_parsear(raw_session, con_patches):
    """
    Intenta TrainingSession(raw) y parse_samples().
    Retorna un dict con los resultados.
    """
    from polar_rcx5_datalink.parser import TrainingSession

    resultado = {
        "info_ok":     False,
        "samples_ok":  False,
        "num_samples": 0,
        "info":        {},
        "info_error":  None,
        "samples_error": None,
    }

    # --- TrainingSession() ---
    try:
        sess = TrainingSession(raw_session)
        resultado["info_ok"] = True
        resultado["info"] = dict(sess.info) if sess.info else {}
    except Exception as e:
        resultado["info_error"] = _fmt_exc(e)
        return resultado

    # --- parse_samples() ---
    try:
        if sess.has_gps and con_patches:
            sess.has_gps = False
            sess._samples_bits = sess._get_samples_bits()
        sess.parse_samples()
        resultado["samples_ok"]  = True
        resultado["num_samples"] = len(sess.samples)
    except Exception as e:
        resultado["samples_error"] = _fmt_exc(e)

    return resultado


def _fmt_exc(e):
    lines = traceback.format_exception_only(type(e), e)
    return "".join(lines).strip()


def analizar_sesion(idx, raw_session):
    pkt0  = raw_session[0]
    hdr   = leer_header_directo(pkt0)

    print(f"\n{'─'*70}")
    print(f"  SESIÓN {idx}  —  {hdr.get('start','?')}  dur={hdr.get('duration','?')}")
    print(f"  paquetes={len(raw_session)}  bytes_pkt0={len(pkt0)}")
    print(f"  header directo → HR avg={hdr.get('hr_avg')} max={hdr.get('hr_max')} "
          f"min={hdr.get('hr_min')}  gps={hdr.get('has_gps')}  laps_hdr={hdr.get('laps_hdr')}")
    print()

    # Sin patches
    r_sin = intentar_parsear(raw_session, con_patches=False)
    _imprimir_resultado("SIN patches", r_sin, hdr)

    # Con patches (reimportar limpio no es posible en Python fácilmente,
    # pero como los patches son aditivos/idempotentes alcanza con aplicar y probar)
    sys.path.insert(0, str(Path(__file__).parent))
    import patches as _patches
    _patches.apply_patches()
    r_con = intentar_parsear(raw_session, con_patches=True)
    _imprimir_resultado("CON patches", r_con, hdr)


def _imprimir_resultado(label, r, hdr):
    print(f"  [{label}]")
    if not r["info_ok"]:
        print(f"    TrainingSession() → ERROR: {r['info_error']}")
        return

    info = r["info"]
    hr_avg_p = info.get("hr_avg")
    hr_max_p = info.get("hr_max")
    hr_min_p = info.get("hr_min")
    print(f"    TrainingSession() → OK   HR avg={hr_avg_p} max={hr_max_p} min={hr_min_p}")

    # Comparar con header directo
    if hdr.get("has_hr"):
        diffs = []
        for campo in ("hr_avg", "hr_max", "hr_min"):
            v_hdr = hdr.get(campo)
            v_psr = info.get(campo)
            if v_hdr is not None and v_psr is not None and v_hdr != v_psr:
                diffs.append(f"{campo}: header={v_hdr} parser={v_psr}")
        if diffs:
            print(f"    ⚠ Diferencias vs header: {', '.join(diffs)}")

    if r["samples_ok"]:
        print(f"    parse_samples()   → OK   {r['num_samples']} muestras")
    else:
        print(f"    parse_samples()   → ERROR: {r['samples_error']}")
    print()


def main():
    parser = argparse.ArgumentParser(description="Explorar sesiones raw offline")
    parser.add_argument("--sesion", type=int, default=None,
                        help="Número de sesión a analizar (1-indexado). Sin este arg: todas.")
    args = parser.parse_args()

    if not RAW_PKL.exists():
        print(f"No se encontró {RAW_PKL}")
        print("Ejecutá primero: python scripts/descargar_raw.py")
        sys.exit(1)

    with open(RAW_PKL, "rb") as f:
        raw_sessions = pickle.load(f)

    print("=" * 70)
    print(f"EXPLORADOR RAW — {len(raw_sessions)} sesiones en {RAW_PKL.name}")
    print("=" * 70)

    if args.sesion is not None:
        idx = args.sesion
        if idx < 1 or idx > len(raw_sessions):
            print(f"Sesión {idx} no existe (hay {len(raw_sessions)} sesiones).")
            sys.exit(1)
        analizar_sesion(idx, raw_sessions[idx - 1])
    else:
        for i, session in enumerate(raw_sessions, 1):
            analizar_sesion(i, session)

    print(f"\n{'─'*70}")
    print("Exploración completada.")


if __name__ == "__main__":
    main()
