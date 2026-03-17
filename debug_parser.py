"""Debug del parser custom vs librería."""
import sys
sys.path.insert(0, 'scripts')

import pickle
from pathlib import Path

import patches
patches.apply_patches()

from polar_rcx5_datalink.parser import TrainingSession
from procesar_sesiones import parsear_hr_custom, detectar_laps_nogps, _hr_valido

DATA_DIR = Path("data")
RAW_PKL = DATA_DIR / "raw_sessions.pkl"

with open(RAW_PKL, "rb") as f:
    raw_sessions = pickle.load(f)

# Última sesión
raw_session = raw_sessions[-1]
sess = TrainingSession(raw_session)

if sess.has_gps:
    sess.has_gps = False
    sess._samples_bits = sess._get_samples_bits()

print("="*70)
print("COMPARACIÓN: Parser librería vs Parser custom")
print("="*70)
print(f"\nSesión: {sess.start_time}")
print(f"Duración: {sess.duration}s")
print(f"Sample rate: {sess.info.get('sample_rate')}s")

# Detectar laps
laps, laps_header, lap_offsets = detectar_laps_nogps(sess)
print(f"\nLaps detectados: {len(laps)}")
print(f"Laps header: {laps_header}")
print(f"Posiciones de lap (bits): {lap_offsets}")

# Parser librería
print("\n" + "="*70)
print("PARSER LIBRERÍA (sess.parse_samples)")
print("="*70)
sess.parse_samples()
lib_hrs = [s.hr for s in sess.samples if s.hr is not None and _hr_valido(s.hr)]
print(f"Muestras: {len(lib_hrs)}")
if lib_hrs:
    print(f"HR min: {min(lib_hrs)} bpm")
    print(f"HR max: {max(lib_hrs)} bpm")
    print(f"HR avg: {sum(lib_hrs)/len(lib_hrs):.1f} bpm")
    
    extremos_lib = [h for h in lib_hrs if h > 200 or h < 40]
    print(f"Valores extremos (>200 o <40): {len(extremos_lib)}")
    if extremos_lib:
        print(f"  Ejemplos: {extremos_lib[:10]}")

# Parser custom
print("\n" + "="*70)
print("PARSER CUSTOM (parsear_hr_custom)")
print("="*70)

# Resetear sesión
sess2 = TrainingSession(raw_session)
if sess2.has_gps:
    sess2.has_gps = False
    sess2._samples_bits = sess2._get_samples_bits()

custom_hrs = parsear_hr_custom(sess2)
custom_hrs_valid = [h for h in custom_hrs if h is not None]
print(f"Muestras: {len(custom_hrs_valid)}")
if custom_hrs_valid:
    print(f"HR min: {min(custom_hrs_valid)} bpm")
    print(f"HR max: {max(custom_hrs_valid)} bpm")
    print(f"HR avg: {sum(custom_hrs_valid)/len(custom_hrs_valid):.1f} bpm")
    
    extremos_custom = [h for h in custom_hrs_valid if h > 200 or h < 40]
    print(f"Valores extremos (>200 o <40): {len(extremos_custom)}")
    if extremos_custom:
        print(f"  Ejemplos: {extremos_custom[:10]}")

# Comparar primeras 20 muestras
print("\n" + "="*70)
print("COMPARACIÓN PRIMERAS 20 MUESTRAS")
print("="*70)
print(f"{'Idx':<5} {'Librería':<10} {'Custom':<10} {'Diff':<10}")
print("-"*40)
for i in range(min(20, len(lib_hrs), len(custom_hrs_valid))):
    lib_hr = lib_hrs[i]
    custom_hr = custom_hrs_valid[i]
    diff = "✓" if lib_hr == custom_hr else f"✗ ({lib_hr - custom_hr:+d})"
    print(f"{i:<5} {lib_hr:<10} {custom_hr:<10} {diff:<10}")

print("\n" + "="*70)
print("BÚSQUEDA DE BLOQUES DE LAP NO DETECTADOS (umbral ampliado)")
print("="*70)

sess3 = TrainingSession(raw_session)
if sess3.has_gps:
    sess3.has_gps = False
    sess3._samples_bits = sess3._get_samples_bits()

bits3 = sess3._samples_bits
LAP_BITS = 416
print(f"Total bits en stream: {len(bits3)}")

# Escanear con umbral más alto (0.25 en lugar de 0.15) para encontrar el tercer lap
bajas = []
for start in range(0, len(bits3) - LAP_BITS, 6):
    chunk = bits3[start:start + LAP_BITS]
    density = chunk.count('1') / LAP_BITS
    if density < 0.25:
        bajas.append((start, density))

# Agrupar bloques cercanos (< 500 bits de distancia)
grupos = []
for start, density in bajas:
    if grupos and start - grupos[-1][-1][0] < 500:
        grupos[-1].append((start, density))
    else:
        grupos.append([(start, density)])

print(f"Grupos de baja densidad encontrados: {len(grupos)}")
for i, grupo in enumerate(grupos):
    best = min(grupo, key=lambda x: x[1])
    print(f"  Grupo {i+1}: offset={best[0]:6d}  density_min={best[1]:.3f}  bloques_en_grupo={len(grupo)}")
print("="*70)
