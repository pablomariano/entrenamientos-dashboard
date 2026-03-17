"""
Script de diagnóstico para investigar por qué el parser lee valores de HR >500 bpm.
Analiza paso a paso cómo se parsea la frecuencia cardíaca.
"""

import sys
sys.path.insert(0, r'C:\Users\Pablo\AppData\Local\Programs\Python\Python314\Lib\site-packages')

from polar_rcx5_datalink.datalink import DataLink
from polar_rcx5_datalink.parser import TrainingSession, HRType
from polar_rcx5_datalink.exceptions import SyncError


def diagnosticar_parsing_hr(sess, max_muestras=20):
    """Diagnostica paso a paso cómo se parsean los valores de HR."""
    print("\n" + "="*80)
    print("DIAGNÓSTICO DE PARSING DE FRECUENCIA CARDÍACA")
    print("="*80)
    
    print(f"\nInformación de la sesión:")
    print(f"  ID: {sess.id}")
    print(f"  Fecha: {sess.start_time}")
    print(f"  Tiene HR: {sess.has_hr}")
    print(f"  Tiene GPS: {sess.has_gps}")
    print(f"  Sample rate: {sess.info.get('sample_rate', 'N/A')} segundos")
    
    # Estadísticas del header
    print(f"\nEstadísticas de HR del header:")
    print(f"  HR Promedio: {sess.info.get('hr_avg', 'N/A')} bpm")
    print(f"  HR Máximo: {sess.info.get('hr_max', 'N/A')} bpm")
    print(f"  HR Mínimo: {sess.info.get('hr_min', 'N/A')} bpm")
    
    if not sess.has_hr:
        print("\n⚠️ Esta sesión NO tiene HR. No hay nada que parsear.")
        return
    
    # Intentar parsear muestras con diagnóstico detallado
    print(f"\n" + "="*80)
    print("PARSEANDO MUESTRAS (primeras {})".format(max_muestras))
    print("="*80)
    
    try:
        # Parsear primera muestra
        sess.samples = [sess._parse_first_sample()]
        print(f"\n[Muestra 0] Primera muestra:")
        print(f"  HR: {sess.samples[0].hr}")
        
        # Parsear siguientes muestras con detalle
        muestra_num = 1
        errores = []
        valores_sospechosos = []
        
        while (sess._cursor < len(sess._samples_bits) 
               and len(sess._next_bits(7)) > 5 
               and muestra_num <= max_muestras):
            
            print(f"\n[Muestra {muestra_num}]")
            cursor_inicio = sess._cursor
            
            # Parsear HR
            if sess.has_hr:
                try:
                    # Leer los próximos 11 bits para HR
                    bits_hr = sess._next_bits(11)
                    print(f"  Bits HR (11): {bits_hr}")
                    
                    # Determinar tipo de valor
                    prefix = bits_hr[0:2]
                    print(f"  Prefix (2 bits): {prefix}", end=" ")
                    
                    try:
                        val_type = HRType(prefix)
                        print(f"→ {val_type.name}")
                    except:
                        print("→ DESCONOCIDO")
                        val_type = None
                    
                    # Procesar
                    hr_prev = sess._prev_sample().hr if sess.samples else None
                    hr, val_type, offset = sess._process_hr_bits(bits_hr)
                    
                    is_full = val_type in (HRType.FULL_WITH_PREFIX, HRType.FULL_PREFIXLESS)
                    
                    if is_full:
                        hr_final = hr
                        print(f"  Tipo: VALOR COMPLETO")
                        print(f"  Valor leído: {hr} bpm")
                    else:
                        hr_final = (hr_prev or 0) + hr
                        print(f"  Tipo: DELTA")
                        print(f"  Delta: {hr:+d}")
                        print(f"  HR anterior: {hr_prev}")
                        print(f"  HR calculado: {hr_prev} + {hr} = {hr_final}")
                    
                    # Verificar si el valor es sospechoso
                    if hr_final > 250 or hr_final < 30:
                        print(f"  ⚠️ VALOR SOSPECHOSO: {hr_final} bpm (fuera de rango 30-250)")
                        valores_sospechosos.append({
                            'muestra': muestra_num,
                            'hr': hr_final,
                            'tipo': val_type.name if val_type else 'UNKNOWN',
                            'bits': bits_hr
                        })
                    
                    sess._cursor += offset
                    
                    # Manejar estado de "frozen" y deltas
                    if is_full:
                        sess._reset_zero_delta_counter(sess.SampleFields.HR)
                    else:
                        sess._handle_delta(sess.SampleFields.HR, hr)
                    
                    # Si no tiene GPS, solo guardar HR
                    if not sess.has_gps:
                        from polar_rcx5_datalink.parser import Sample
                        sess.samples.append(Sample(hr_final))
                        muestra_num += 1
                        continue
                    
                    # Si tiene GPS, parsear el resto (simplificado)
                    # ... (aquí se parsearian GPS, velocidad, distancia, etc.)
                    # Por ahora solo nos interesa HR, así que saltamos
                    break
                    
                except Exception as e:
                    print(f"  ✗ ERROR: {type(e).__name__}: {e}")
                    errores.append({
                        'muestra': muestra_num,
                        'error': str(e),
                        'cursor': cursor_inicio
                    })
                    break
            
            muestra_num += 1
        
        # Resumen
        print(f"\n" + "="*80)
        print("RESUMEN DEL DIAGNÓSTICO")
        print("="*80)
        print(f"Muestras parseadas: {len(sess.samples)}")
        print(f"Valores sospechosos encontrados: {len(valores_sospechosos)}")
        
        if valores_sospechosos:
            print(f"\nValores sospechosos (>250 o <30 bpm):")
            for v in valores_sospechosos[:10]:  # Mostrar primeros 10
                print(f"  Muestra {v['muestra']}: {v['hr']} bpm")
                print(f"    Tipo: {v['tipo']}")
                print(f"    Bits: {v['bits']}")
        
        if errores:
            print(f"\nErrores encontrados:")
            for e in errores:
                print(f"  Muestra {e['muestra']}: {e['error']}")
        
        # Análisis de los valores
        if len(sess.samples) > 0:
            hrs = [s.hr for s in sess.samples if s.hr is not None]
            if hrs:
                print(f"\nAnálisis de valores HR parseados:")
                print(f"  Mínimo: {min(hrs)} bpm")
                print(f"  Máximo: {max(hrs)} bpm")
                print(f"  Promedio: {sum(hrs)/len(hrs):.1f} bpm")
                
                fuera_rango = [h for h in hrs if h > 250 or h < 30]
                print(f"  Valores fuera de rango (30-250): {len(fuera_rango)}/{len(hrs)}")
                
                if fuera_rango:
                    print(f"  Ejemplos: {fuera_rango[:10]}")
        
    except Exception as e:
        print(f"\n✗ ERROR CRÍTICO: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()


def main():
    print("="*80)
    print("DIAGNÓSTICO DE PARSING DE HR - Polar RCX5")
    print("="*80)
    print("\nEste script analiza cómo se parsean los valores de HR para identificar")
    print("por qué aparecen valores >500 bpm (que son fisiológicamente imposibles).\n")
    
    input("Presiona ENTER cuando hayas seleccionado 'Connect > Start synchronizing' en tu reloj...")
    
    try:
        # Sincronizar con el reloj
        print("\n[1/2] Sincronizando con el reloj...")
        with DataLink() as dl:
            dl.synchronize()
            raw_sessions = dl.sessions
        
        print(f"✓ Sincronización completada: {len(raw_sessions)} sesiones encontradas")
        
        # Analizar sesiones con HR
        print(f"\n[2/2] Buscando sesiones con HR...")
        sesiones_con_hr = []
        
        for i, raw_session in enumerate(raw_sessions):
            try:
                sess = TrainingSession(raw_session)
                if sess.has_hr:
                    sesiones_con_hr.append((i, sess))
            except:
                pass
        
        print(f"✓ Encontradas {len(sesiones_con_hr)} sesiones con HR")
        
        if len(sesiones_con_hr) == 0:
            print("\n⚠️ No hay sesiones con HR para analizar.")
            return
        
        # Diagnosticar la sesión más reciente con HR
        idx, sess_reciente = sesiones_con_hr[-1]
        print(f"\nAnalizando sesión más reciente con HR (#{idx+1})...")
        
        diagnosticar_parsing_hr(sess_reciente, max_muestras=30)
        
        print(f"\n" + "="*80)
        print("CONCLUSIONES")
        print("="*80)
        print("\nSi ves valores >250 bpm:")
        print("1. Verifica el TIPO de valor (FULL vs DELTA)")
        print("2. Si es DELTA, revisa si el HR anterior ya era alto")
        print("3. Si es FULL, el problema está en cómo se leen los bits")
        print("\nPosibles causas:")
        print("- Parser desincronizado (leyendo bits del lugar equivocado)")
        print("- Datos corruptos en el reloj")
        print("- Error en la lógica de deltas acumulados")
        print("- Formato de datos diferente (firmware del reloj)")
        
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
