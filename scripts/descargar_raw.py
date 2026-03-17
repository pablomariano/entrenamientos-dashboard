"""
descargar_raw.py — Descarga sesiones del reloj Polar RCX5 y las guarda raw.

Aplica solo los 2 patches mínimos inevitables en Windows (timeout + tzlocal)
y NO realiza ningún procesamiento sobre los datos descargados.

Salida:
    data/raw_sessions.pkl  — list[list[bytes]], pickle fiel (fuente de verdad)
    data/raw_sessions.json — misma estructura con bytes como list[int] (portable)

Uso:
    python scripts/descargar_raw.py
"""

import json
import pickle
import sys
from pathlib import Path

# Asegurarse de que scripts/ esté en el path para importar patches
sys.path.insert(0, str(Path(__file__).parent))

import patches
patches.apply_patches()  # timeout Windows + tzlocal — sin más

from polar_rcx5_datalink.datalink import DataLink
from polar_rcx5_datalink.exceptions import SyncError

DATA_DIR = Path(__file__).parent.parent / "data"
RAW_PKL  = DATA_DIR / "raw_sessions.pkl"
RAW_JSON = DATA_DIR / "raw_sessions.json"


def main():
    print("=" * 70)
    print("DESCARGA RAW — Polar RCX5")
    print("=" * 70)
    print()
    print("Pasos:")
    print("  1. Conectá el dongle Polar DataLink al USB")
    print("  2. En el reloj: Connect > Start synchronizing")
    input("  3. Presioná ENTER cuando el reloj esté listo para sincronizar...")
    print()

    try:
        print("[1/3] Sincronizando con el reloj...")
        with DataLink() as dl:
            dl.synchronize()
            raw_sessions = dl.sessions
        print(f"  ✓ Sincronización completada: {len(raw_sessions)} sesiones")
    except SyncError as e:
        print(f"  ✗ Error de sincronización: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n  Cancelado por el usuario.")
        sys.exit(0)
    except Exception as e:
        print(f"  ✗ Error inesperado: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    # Reporte de lo descargado
    print()
    print("Sesiones descargadas:")
    for i, session in enumerate(raw_sessions, 1):
        total_bytes = sum(len(pkt) for pkt in session)
        print(f"  Sesión {i:>3}: {len(session)} paquete(s), "
              f"{total_bytes} bytes en total "
              f"(primer paquete: {len(session[0])} bytes)")

    # Guardar pickle
    print()
    print("[2/3] Guardando pickle...")
    DATA_DIR.mkdir(exist_ok=True)
    with open(RAW_PKL, "wb") as f:
        pickle.dump(raw_sessions, f)
    size_kb = RAW_PKL.stat().st_size / 1024
    print(f"  ✓ {RAW_PKL}  ({size_kb:.1f} KB)")

    # Guardar JSON (bytes → list[int] para portabilidad)
    print()
    print("[3/3] Guardando JSON...")
    serializable = [
        [list(pkt) for pkt in session]
        for session in raw_sessions
    ]
    with open(RAW_JSON, "w", encoding="utf-8") as f:
        json.dump(serializable, f)
    size_kb = RAW_JSON.stat().st_size / 1024
    print(f"  ✓ {RAW_JSON}  ({size_kb:.1f} KB)")

    print()
    print("=" * 70)
    print(f"Listo. {len(raw_sessions)} sesiones guardadas en data/")
    print("  → Siguiente paso: python scripts/explorar_raw.py")
    print("=" * 70)


if __name__ == "__main__":
    main()
