"""
Script para encontrar el offset correcto del HR inicial cuando hay GPS.
Prueba diferentes valores hasta encontrar uno que dé un HR razonable.
"""

import sys
sys.path.insert(0, r'C:\Users\Pablo\AppData\Local\Programs\Python\Python314\Lib\site-packages')

from polar_rcx5_datalink.datalink import DataLink
from polar_rcx5_datalink.parser import TrainingSession, HRType
from polar_rcx5_datalink.exceptions import SyncError


def probar_offsets(sess, offsets_a_probar=range(0, 100, 1)):
    """Prueba diferentes offsets iniciales para encontrar el HR correcto."""
    
    print(f"\nEstadísticas de HR del header (valores correctos):")
    print(f"  HR Promedio: {sess.info.get('hr_avg')} bpm")
    print(f"  HR Máximo: {sess.info.get('hr_max')} bpm")
    print(f"  HR Mínimo: {sess.info.get('hr_min')} bpm")
    
    print(f"\nProbando offsets de {min(offsets_a_probar)} a {max(offsets_a_probar)}...")
    print(f"Buscando HR inicial cercano a {sess.info.get('hr_avg')} bpm\n")
    
    resultados = []
    
    for offset in offsets_a_probar:
        try:
            # Simular el parsing con este offset
            cursor_test = offset if sess.has_gps else 0
            
            # Leer bits de HR desde este offset
            bits_hr = sess._samples_bits[cursor_test:cursor_test+11]
            
            if len(bits_hr) < 11:
                continue
            
            # Procesar HR
            hr, val_type, bit_offset = sess._process_hr_bits(bits_hr)
            
            # Solo considerar valores completos (no deltas)
            is_full = val_type in (HRType.FULL_WITH_PREFIX, HRType.FULL_PREFIXLESS)
            
            if is_full and 30 <= hr <= 250:
                # Calcular qué tan cerca está del promedio esperado
                hr_esperado = sess.info.get('hr_avg', 140)
                diferencia = abs(hr - hr_esperado)
                
                resultados.append({
                    'offset': offset,
                    'hr': hr,
                    'tipo': val_type.name,
                    'diferencia': diferencia,
                    'bits': bits_hr
                })
                
                print(f"Offset {offset:3d}: HR = {hr:3d} bpm ({val_type.name:20s}) | Dif: {diferencia:3.0f}")
        
        except Exception as e:
            pass
    
    if not resultados:
        print("\n⚠️ No se encontraron offsets válidos.")
        return None
    
    # Ordenar por menor diferencia
    resultados.sort(key=lambda x: x['diferencia'])
    
    print(f"\n" + "="*80)
    print("MEJORES CANDIDATOS (ordenados por cercanía al HR promedio)")
    print("="*80)
    
    for i, r in enumerate(resultados[:10], 1):
        print(f"{i}. Offset {r['offset']:3d}: HR = {r['hr']:3d} bpm | Diferencia: {r['diferencia']:3.0f} bpm")
        print(f"   Tipo: {r['tipo']}")
        print(f"   Bits: {r['bits']}")
    
    # Mejor candidato
    mejor = resultados[0]
    print(f"\n" + "="*80)
    print("MEJOR CANDIDATO")
    print("="*80)
    print(f"Offset: {mejor['offset']}")
    print(f"HR: {mejor['hr']} bpm (esperado: ~{sess.info.get('hr_avg')} bpm)")
    print(f"Diferencia: {mejor['diferencia']:.1f} bpm")
    
    return mejor['offset']


def main():
    print("="*80)
    print("ENCONTRAR OFFSET CORRECTO DE HR - Polar RCX5")
    print("="*80)
    print("\nEste script prueba diferentes offsets iniciales para encontrar")
    print("desde dónde se debe empezar a leer el HR cuando hay GPS.\n")
    
    input("Presiona ENTER cuando hayas seleccionado 'Connect > Start synchronizing' en tu reloj...")
    
    try:
        # Sincronizar con el reloj
        print("\n[1/2] Sincronizando con el reloj...")
        with DataLink() as dl:
            dl.synchronize()
            raw_sessions = dl.sessions
        
        print(f"✓ Sincronización completada: {len(raw_sessions)} sesiones encontradas")
        
        # Buscar sesiones con HR y GPS
        print(f"\n[2/2] Buscando sesiones con HR y GPS...")
        sesiones_con_hr_gps = []
        
        for i, raw_session in enumerate(raw_sessions):
            try:
                sess = TrainingSession(raw_session)
                if sess.has_hr and sess.has_gps:
                    sesiones_con_hr_gps.append((i, sess))
            except:
                pass
        
        print(f"✓ Encontradas {len(sesiones_con_hr_gps)} sesiones con HR y GPS")
        
        if len(sesiones_con_hr_gps) == 0:
            print("\n⚠️ No hay sesiones con HR y GPS para analizar.")
            return
        
        # Analizar la sesión más reciente
        idx, sess_reciente = sesiones_con_hr_gps[-1]
        print(f"\nAnalizando sesión más reciente con HR y GPS (#{idx+1})...")
        print(f"Fecha: {sess_reciente.start_time}")
        
        mejor_offset = probar_offsets(sess_reciente, range(0, 100))
        
        if mejor_offset is not None:
            print(f"\n" + "="*80)
            print("SOLUCIÓN")
            print("="*80)
            print(f"\nEl offset correcto parece ser: {mejor_offset}")
            print(f"\nEn lugar de usar offset 22 (valor actual), deberías usar {mejor_offset}.")
            print(f"\nPara corregir el parser, modifica la línea en _parse_first_sample():")
            print(f"  Antes: self._cursor = 22")
            print(f"  Después: self._cursor = {mejor_offset}")
            print(f"\nArchivo a modificar:")
            print(f"  C:\\Users\\Pablo\\AppData\\Local\\Programs\\Python\\Python314\\")
            print(f"  Lib\\site-packages\\polar_rcx5_datalink\\parser.py")
            print(f"  Línea aproximada: 332")
        
    except SyncError as e:
        print(f"\n✗ Error de sincronización: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\nOperación cancelada por el usuario")
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ Error inesperado: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
