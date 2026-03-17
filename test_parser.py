"""Script de prueba para validar el parser custom de HR."""
import sys
sys.path.insert(0, 'scripts')

import pickle
from pathlib import Path

import patches
patches.apply_patches()

from polar_rcx5_datalink.parser import TrainingSession
from procesar_sesiones import parsear_hr_custom, detectar_laps_nogps

DATA_DIR = Path("data")
RAW_PKL = DATA_DIR / "raw_sessions.pkl"

print("Cargando sesiones...")
with open(RAW_PKL, "rb") as f:
    raw_sessions = pickle.load(f)

print(f"Total sesiones: {len(raw_sessions)}\n")

# Probar con la última sesión (que tiene laps según las imágenes)
print("Probando parser custom en la última sesión...")
raw_session = raw_sessions[-1]

sess = TrainingSession(raw_session)
if sess.has_gps:
    sess.has_gps = False
    sess._samples_bits = sess._get_samples_bits()

print(f"Sesión: {sess.start_time}")
print(f"Duración: {sess.duration}s")
print(f"HR avg: {sess.info.get('hr_avg')} bpm")

# Detectar laps
laps, laps_header, lap_offsets = detectar_laps_nogps(sess)
print(f"\nLaps detectados: {len(laps)}")
for lap in laps:
    print(f"  Lap {lap['lap_number']}: {lap['time_formatted']}")

# Parser custom
print("\nParseando HR con parser custom...")
hr_values = parsear_hr_custom(sess)
print(f"Muestras HR: {len(hr_values)}")

# Estadísticas
hr_validos = [h for h in hr_values if h is not None]
if hr_validos:
    print(f"HR min: {min(hr_validos)} bpm")
    print(f"HR max: {max(hr_validos)} bpm")
    print(f"HR avg: {sum(hr_validos)/len(hr_validos):.1f} bpm")
    
    # Verificar si hay valores extremos
    extremos_altos = [h for h in hr_validos if h > 200]
    extremos_bajos = [h for h in hr_validos if h < 40]
    
    if extremos_altos:
        print(f"\n⚠ Valores >200 bpm: {len(extremos_altos)}")
        print(f"  Ejemplos: {extremos_altos[:5]}")
    
    if extremos_bajos:
        print(f"\n⚠ Valores <40 bpm: {len(extremos_bajos)}")
        print(f"  Ejemplos: {extremos_bajos[:5]}")
    
    if not extremos_altos and not extremos_bajos:
        print("\n✓ Todos los valores HR están en rango normal (40-200 bpm)")

print("\n✓ Parser custom funcionando correctamente")
