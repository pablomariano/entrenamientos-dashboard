"""Script temporal para analizar picos de HR en la última sesión."""
import json
import sys

sys.stdout = open(r'C:\Users\Pablo\Desktop\entrenamientos_dashboard\_picos_output.txt', 'w', encoding='utf-8')

with open(r'C:\Users\Pablo\Desktop\entrenamientos_dashboard\entrenamientos.json', encoding='utf-8') as f:
    data = json.load(f)

sessions = data['sessions']
s = sessions[-1]

print('=== ULTIMA SESION ===')
print(f"Fecha:     {s.get('start_time')}")
print(f"Duración:  {s.get('duration_formatted')} ({s.get('duration_seconds')}s)")
print(f"HR avg:    {s.get('hr_avg')} bpm  (header del reloj)")
print(f"HR max:    {s.get('hr_max')} bpm  (header del reloj)")
print(f"HR min:    {s.get('hr_min')} bpm  (header del reloj)")
print(f"Samples:   {s.get('num_hr_samples')}")
print(f"Laps:      {s.get('num_laps')} detectados / {s.get('num_laps_header')} en header")

samples = s.get('hr_samples', [])
if not samples:
    print("Sin muestras HR.")
    sys.exit(0)

hrs = [x['hr'] for x in samples]

altos  = [(x['time_formatted'], x['hr']) for x in samples if x['hr'] > 200]
bajos  = [(x['time_formatted'], x['hr']) for x in samples if x['hr'] < 40]

print(f"\n--- Picos >200 bpm: {len(altos)} ---")
for t, h in altos:
    print(f"  {t}: {h} bpm")

print(f"\n--- Picos <40 bpm: {len(bajos)} ---")
for t, h in bajos:
    print(f"  {t}: {h} bpm")

# Contexto alrededor de cada pico alto (±3 muestras)
if altos:
    print("\n--- Contexto picos >200 (±3 muestras) ---")
    indices_altos = [i for i, x in enumerate(samples) if x['hr'] > 200]
    for idx in indices_altos:
        start = max(0, idx - 3)
        end   = min(len(samples), idx + 4)
        print(f"  [muestra {idx}]")
        for j in range(start, end):
            marker = " <<<<" if j == idx else ""
            print(f"    {samples[j]['time_formatted']}: {samples[j]['hr']} bpm{marker}")

# Contexto alrededor de cada pico bajo
if bajos:
    print("\n--- Contexto picos <40 (±3 muestras) ---")
    indices_bajos = [i for i, x in enumerate(samples) if x['hr'] < 40]
    for idx in indices_bajos:
        start = max(0, idx - 3)
        end   = min(len(samples), idx + 4)
        print(f"  [muestra {idx}]")
        for j in range(start, end):
            marker = " <<<<" if j == idx else ""
            print(f"    {samples[j]['time_formatted']}: {samples[j]['hr']} bpm{marker}")

# Buscar patrones: picos aislados vs sostenidos
print("\n--- Análisis de patrón ---")
for idx in [i for i, x in enumerate(samples) if x['hr'] > 200 or x['hr'] < 40]:
    prev_hr = samples[idx-1]['hr'] if idx > 0 else None
    next_hr = samples[idx+1]['hr'] if idx < len(samples)-1 else None
    curr_hr = samples[idx]['hr']
    aislado = True
    if prev_hr is not None and (prev_hr > 200 or prev_hr < 40):
        aislado = False
    if next_hr is not None and (next_hr > 200 or next_hr < 40):
        aislado = False
    tipo = "AISLADO" if aislado else "SOSTENIDO"
    salto_prev = abs(curr_hr - prev_hr) if prev_hr else '?'
    salto_next = abs(curr_hr - next_hr) if next_hr else '?'
    print(f"  {samples[idx]['time_formatted']}: {curr_hr} bpm [{tipo}]  salto_prev={salto_prev}  salto_next={salto_next}")
