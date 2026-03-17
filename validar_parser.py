"""Validación del parser custom - escribe resultado en archivo."""
import json
from pathlib import Path

DATA_DIR = Path("data")
JSON_FILE = DATA_DIR / "entrenamientos.json"
OUTPUT = Path("validacion_parser.txt")

with open(JSON_FILE, encoding='utf-8') as f:
    data = json.load(f)

with open(OUTPUT, 'w', encoding='utf-8') as out:
    out.write("="*70 + "\n")
    out.write("VALIDACIÓN DEL PARSER CUSTOM DE HR\n")
    out.write("="*70 + "\n\n")
    
    # Última sesión (la que tiene laps según las imágenes)
    sess = data['sessions'][-1]
    
    out.write(f"Última sesión:\n")
    out.write(f"  Fecha: {sess['start_time']}\n")
    out.write(f"  Duración: {sess['duration_formatted']}\n")
    out.write(f"  HR avg (header): {sess.get('hr_avg')} bpm\n")
    out.write(f"  HR max (header): {sess.get('hr_max')} bpm\n")
    out.write(f"  HR min (header): {sess.get('hr_min')} bpm\n")
    out.write(f"  Laps detectados: {sess['num_laps']}\n")
    out.write(f"  Muestras HR: {sess['num_hr_samples']}\n\n")
    
    if sess['num_laps'] > 0:
        out.write("Laps:\n")
        for lap in sess['laps']:
            out.write(f"  Lap {lap['lap_number']}: {lap['time_formatted']}\n")
        out.write("\n")
    
    # Analizar valores HR
    if sess['hr_samples']:
        hrs = [s['hr'] for s in sess['hr_samples']]
        out.write(f"Estadísticas HR (de muestras parseadas):\n")
        out.write(f"  Min: {min(hrs)} bpm\n")
        out.write(f"  Max: {max(hrs)} bpm\n")
        out.write(f"  Avg: {sum(hrs)/len(hrs):.1f} bpm\n\n")
        
        # Verificar valores extremos
        extremos_altos = [h for h in hrs if h > 200]
        extremos_bajos = [h for h in hrs if h < 40]
        
        out.write("Verificación de valores extremos:\n")
        if extremos_altos:
            out.write(f"  ⚠ Valores >200 bpm: {len(extremos_altos)}\n")
            out.write(f"     Ejemplos: {extremos_altos[:10]}\n")
        else:
            out.write(f"  ✓ Sin valores >200 bpm\n")
        
        if extremos_bajos:
            out.write(f"  ⚠ Valores <40 bpm: {len(extremos_bajos)}\n")
            out.write(f"     Ejemplos: {extremos_bajos[:10]}\n")
        else:
            out.write(f"  ✓ Sin valores <40 bpm\n")
        
        out.write("\n")
        
        # Verificar saltos bruscos
        saltos_grandes = []
        for i in range(1, len(hrs)):
            delta = abs(hrs[i] - hrs[i-1])
            if delta > 50:
                saltos_grandes.append((i, hrs[i-1], hrs[i], delta))
        
        if saltos_grandes:
            out.write(f"  ⚠ Saltos >50 bpm entre muestras consecutivas: {len(saltos_grandes)}\n")
            for idx, prev, curr, delta in saltos_grandes[:5]:
                out.write(f"     Muestra {idx}: {prev} → {curr} (Δ{delta})\n")
        else:
            out.write(f"  ✓ Sin saltos >50 bpm entre muestras consecutivas\n")
        
        out.write("\n")
        
        # Conclusión
        if not extremos_altos and not extremos_bajos and not saltos_grandes:
            out.write("="*70 + "\n")
            out.write("✓ PARSER CUSTOM FUNCIONANDO CORRECTAMENTE\n")
            out.write("  - Sin valores extremos (>200 o <40 bpm)\n")
            out.write("  - Sin saltos bruscos entre muestras\n")
            out.write("  - Los bloques de lap fueron saltados correctamente\n")
            out.write("="*70 + "\n")
        else:
            out.write("="*70 + "\n")
            out.write("⚠ POSIBLES PROBLEMAS DETECTADOS\n")
            out.write("  Revisar valores extremos o saltos bruscos arriba\n")
            out.write("="*70 + "\n")

print(f"Validación escrita en {OUTPUT}")
