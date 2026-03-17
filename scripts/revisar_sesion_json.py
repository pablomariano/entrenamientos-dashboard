"""
Script para revisar una sesión específica desde el archivo JSON exportado
"""

import json
from pathlib import Path
from datetime import datetime


def analizar_sesion_desde_json(sesion):
    """Analiza una sesión desde los datos JSON."""
    print(f"\n{'='*80}")
    print(f"ANÁLISIS DETALLADO DE LA SESIÓN")
    print(f"{'='*80}")
    
    print(f"\n📅 Información General:")
    print(f"  ID: {sesion.get('id', 'N/A')}")
    print(f"  Fecha inicio: {sesion.get('start_time', 'N/A')}")
    print(f"  Duración: {sesion.get('duration_seconds', 0)} segundos ({sesion.get('duration_formatted', 'N/A')})")
    print(f"  Tiene HR: {sesion.get('has_hr', False)}")
    
    print(f"\n❤️ Estadísticas de HR:")
    print(f"  HR Promedio: {sesion.get('hr_avg', 'N/A')} bpm")
    print(f"  HR Máximo: {sesion.get('hr_max', 'N/A')} bpm")
    print(f"  HR Mínimo: {sesion.get('hr_min', 'N/A')} bpm")
    print(f"  Sample rate: {sesion.get('sample_rate_seconds', 'N/A')} segundos")
    
    # Analizar muestras de HR si existen
    hr_samples = sesion.get('hr_samples', [])
    num_samples = sesion.get('num_hr_samples', len(hr_samples))
    
    print(f"\n📊 Muestras de HR:")
    print(f"  Total de muestras: {num_samples}")
    
    if len(hr_samples) == 0:
        print("  ⚠️ No hay muestras de HR disponibles")
        print("\n💡 Esto puede significar:")
        print("  - La sesión no se pudo parsear completamente")
        print("  - Los datos fueron exportados sin muestras detalladas")
        return
    
    # Extraer valores de HR
    hrs = [s['hr'] for s in hr_samples if s.get('hr') is not None]
    
    if len(hrs) == 0:
        print("  ⚠️ No hay valores de HR en las muestras")
        return
    
    # Estadísticas de las muestras
    min_hr = min(hrs)
    max_hr = max(hrs)
    avg_hr = sum(hrs) / len(hrs)
    
    print(f"\n📈 Estadísticas de las Muestras:")
    print(f"  HR Mínimo: {min_hr} bpm")
    print(f"  HR Máximo: {max_hr} bpm")
    print(f"  HR Promedio: {avg_hr:.1f} bpm")
    
    # Análisis de valores anómalos
    valores_validos = [h for h in hrs if 30 <= h <= 250]
    valores_cero = hrs.count(0)
    valores_bajo = [h for h in hrs if 0 < h < 30]
    valores_alto = [h for h in hrs if h > 250]
    
    print(f"\n🔍 Análisis de Valores:")
    print(f"  Valores válidos (30-250 bpm): {len(valores_validos)}/{len(hrs)} ({100*len(valores_validos)/len(hrs):.1f}%)")
    print(f"  Valores cero (0 bpm): {valores_cero} ({100*valores_cero/len(hrs) if hrs else 0:.1f}%)")
    print(f"  Valores bajos (<30 bpm): {len(valores_bajo)} ({100*len(valores_bajo)/len(hrs) if hrs else 0:.1f}%)")
    print(f"  Valores altos (>250 bpm): {len(valores_alto)} ({100*len(valores_alto)/len(hrs) if hrs else 0:.1f}%)")
    
    if valores_bajo:
        print(f"    Ejemplos bajos: {valores_bajo[:10]}")
    if valores_alto:
        print(f"    Ejemplos altos: {valores_alto[:10]}")
    
    # Comparación con estadísticas del header
    hr_avg_header = sesion.get('hr_avg')
    if hr_avg_header:
        diferencia = abs(avg_hr - hr_avg_header)
        
        print(f"\n📊 Comparación con Header:")
        print(f"  Header HR Promedio: {hr_avg_header} bpm")
        print(f"  Muestras HR Promedio: {avg_hr:.1f} bpm")
        print(f"  Diferencia: {diferencia:.1f} bpm", end="")
        
        if diferencia < 5:
            print(" ✅ Excelente")
        elif diferencia < 20:
            print(" ✓ Aceptable")
        else:
            print(" ⚠️ Grande")
    
    # Distribución de HR
    print(f"\n📊 Distribución de HR (solo valores válidos):")
    if valores_validos:
        rangos = {
            'Muy bajo (30-60)': len([h for h in valores_validos if 30 <= h < 60]),
            'Bajo (60-100)': len([h for h in valores_validos if 60 <= h < 100]),
            'Moderado (100-140)': len([h for h in valores_validos if 100 <= h < 140]),
            'Alto (140-180)': len([h for h in valores_validos if 140 <= h < 180]),
            'Muy alto (180-250)': len([h for h in valores_validos if 180 <= h <= 250]),
        }
        
        for rango, count in rangos.items():
            porcentaje = 100 * count / len(valores_validos)
            barra = '█' * int(porcentaje / 2)
            print(f"  {rango:20s}: {count:4d} ({porcentaje:5.1f}%) {barra}")
    
    # Mostrar primeras y últimas 20 muestras
    print(f"\n📝 Primeras 20 muestras de HR:")
    for i, hr in enumerate(hrs[:20]):
        tiempo = hr_samples[i].get('time_formatted', f"{i*sesion.get('sample_rate_seconds', 5)}s")
        marca = ""
        if hr == 0:
            marca = " ⚠️ CERO"
        elif hr < 30:
            marca = " ⚠️ BAJO"
        elif hr > 250:
            marca = " ⚠️ ALTO"
        print(f"  {tiempo:>6s}: {hr:3d} bpm{marca}")
    
    if len(hrs) > 20:
        print(f"\n📝 Últimas 20 muestras de HR:")
        for i in range(max(0, len(hrs)-20), len(hrs)):
            hr = hrs[i]
            tiempo = hr_samples[i].get('time_formatted', f"{i*sesion.get('sample_rate_seconds', 5)}s")
            marca = ""
            if hr == 0:
                marca = " ⚠️ CERO"
            elif hr < 30:
                marca = " ⚠️ BAJO"
            elif hr > 250:
                marca = " ⚠️ ALTO"
            print(f"  {tiempo:>6s}: {hr:3d} bpm{marca}")
    
    # Resumen final
    print(f"\n{'='*80}")
    print("RESUMEN")
    print(f"{'='*80}")
    
    if len(valores_validos) / len(hrs) >= 0.95:
        print("✅ EXCELENTE: >95% de datos válidos")
    elif len(valores_validos) / len(hrs) >= 0.90:
        print("✓ BUENO: >90% de datos válidos")
    elif len(valores_validos) / len(hrs) >= 0.80:
        print("⚠️ ACEPTABLE: >80% de datos válidos")
    else:
        print("❌ PROBLEMÁTICO: <80% de datos válidos")
    
    if hr_avg_header:
        if diferencia < 5:
            print("✅ PROMEDIO PERFECTO: Diferencia <5 bpm con header")
        elif diferencia < 20:
            print("✓ PROMEDIO BUENO: Diferencia <20 bpm con header")
        else:
            print("⚠️ PROMEDIO DESVIADO: Diferencia >20 bpm con header")


def main():
    print("="*80)
    print("ANÁLISIS DE SESIÓN DESDE JSON - 13/2/2026")
    print("="*80)
    
    # Buscar archivo JSON
    json_file = Path(r'C:\Users\Pablo\Desktop\entrenamientos_dashboard\entrenamientos.json')
    
    if not json_file.exists():
        print(f"\n❌ No se encontró el archivo: {json_file}")
        print("\nPrimero debes exportar los datos:")
        print("  python exportar_para_dashboard.py")
        return
    
    try:
        # Leer JSON
        print(f"\nLeyendo archivo: {json_file}")
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        sessions = data.get('sessions', [])
        print(f"✓ Archivo cargado: {len(sessions)} sesiones encontradas")
        
        # Buscar sesión del 13/2/2026
        print(f"\nBuscando sesión del 13/2/2026...")
        sesion_encontrada = None
        
        for sesion in sessions:
            start_time = sesion.get('start_time', '')
            if '2026-02-13' in start_time:
                fecha = datetime.fromisoformat(start_time).strftime('%d/%m/%Y %H:%M:%S')
                print(f"✓ Sesión encontrada: {fecha}")
                sesion_encontrada = sesion
                analizar_sesion_desde_json(sesion)
                break
        
        if not sesion_encontrada:
            print(f"\n⚠️ No se encontró ninguna sesión del 13/2/2026")
            print(f"\nSesiones disponibles (todas):")
            for sesion in sessions:
                try:
                    start_time = sesion.get('start_time', '')
                    fecha = datetime.fromisoformat(start_time).strftime('%d/%m/%Y %H:%M:%S')
                    hr_avg = sesion.get('hr_avg', 'N/A')
                    print(f"  - {fecha} | HR: {hr_avg} bpm")
                except:
                    print(f"  - (sesión con error)")
        
    except Exception as e:
        print(f"\n✗ Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
