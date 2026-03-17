"""
Script de prueba para verificar la extracción de laps.
Sincroniza con el reloj y muestra información detallada sobre los laps detectados.
"""

import json
import sys
from datetime import datetime
from pathlib import Path

# Agregar el path de la librería instalada
sys.path.insert(0, r'C:\Users\Pablo\AppData\Local\Programs\Python\Python314\Lib\site-packages')

from polar_rcx5_datalink.datalink import DataLink
from polar_rcx5_datalink.parser import TrainingSession
from polar_rcx5_datalink.exceptions import ParserError, SyncError
from polar_rcx5_datalink.utils import bcd_to_int
import polar_rcx5_datalink.utils as utils

# Importar las funciones del script principal
from exportar_para_dashboard import extraer_laps_basicos, extraer_laps_alternativos, parsear_sesion_completa


def probar_extraccion_laps():
    print("="*80)
    print("PRUEBA DE EXTRACCIÓN DE LAPS - Polar RCX5")
    print("="*80)
    print("\nEste script prueba la extracción de información de laps")
    print("y muestra resultados detallados para verificar el funcionamiento.\n")
    
    input("Presiona ENTER cuando hayas seleccionado 'Connect > Start synchronizing' en tu reloj...")
    
    try:
        # Sincronizar con el reloj
        print("\n[1/3] Sincronizando con el reloj...")
        with DataLink() as dl:
            dl.synchronize()
            raw_sessions = dl.sessions
        
        print(f"✓ Sincronización completada: {len(raw_sessions)} sesiones encontradas")
        
        # Probar extracción en las primeras 3 sesiones
        print(f"\n[2/3] Probando extracción de laps en las primeras 3 sesiones...")
        
        for i, raw_session in enumerate(raw_sessions[:3], 1):
            print(f"\n{'='*60}")
            print(f"SESIÓN {i}")
            print(f"{'='*60}")
            
            try:
                # Parsear sesión básica
                sess = TrainingSession(raw_session)
                print(f"📅 Fecha: {sess.start_time}")
                print(f"⏱️ Duración: {sess.duration} segundos ({sess.duration//60}:{sess.duration%60:02d})")
                print(f"❤️ Tiene HR: {sess.has_hr}")
                print(f"🛰️ Tiene GPS: {sess.has_gps}")
                
                # Método 1: Extracción básica
                print(f"\n🔍 MÉTODO 1: Extracción básica desde datos raw")
                laps_basicos = extraer_laps_basicos(raw_session)
                
                if isinstance(laps_basicos, list):
                    if len(laps_basicos) > 0:
                        print(f"✓ Detectados {len(laps_basicos)} posibles laps:")
                        for j, lap in enumerate(laps_basicos, 1):
                            if not lap.get('error'):
                                print(f"  Lap {j}:")
                                print(f"    - Posición en bits: {lap.get('bit_position', 'N/A')}")
                                print(f"    - Variación de datos: {lap.get('raw_data_summary', {}).get('data_variation', 'N/A')}")
                                print(f"    - Bytes no-cero: {lap.get('raw_data_summary', {}).get('non_zero_bytes', 'N/A')}")
                            else:
                                print(f"  Error en lap {j}: {lap.get('error')}")
                    else:
                        print("⚠️ No se detectaron laps con este método")
                else:
                    print(f"❌ Error en método 1: {laps_basicos.get('error', 'Error desconocido')}")
                
                # Método 2: Extracción alternativa
                print(f"\n🔍 MÉTODO 2: Extracción alternativa usando parser")
                laps_alternativos = extraer_laps_alternativos(sess)
                
                if isinstance(laps_alternativos, list):
                    if len(laps_alternativos) > 0:
                        laps_validos = [lap for lap in laps_alternativos if not lap.get('error')]
                        if laps_validos:
                            print(f"✓ Detectados {len(laps_validos)} laps:")
                            for lap in laps_validos:
                                print(f"  Lap {lap.get('lap_number', '?')}:")
                                print(f"    - Tiempo aproximado: {lap.get('approximate_time_formatted', 'N/A')}")
                                print(f"    - Posición de muestra: {lap.get('sample_position', 'N/A')}")
                        else:
                            print("⚠️ Se detectaron patrones pero con errores")
                            for lap in laps_alternativos:
                                if lap.get('error'):
                                    print(f"  Error: {lap.get('error')}")
                    else:
                        print("⚠️ No se detectaron laps con este método")
                
                # Método 3: Usar función completa del exportador
                print(f"\n🔍 MÉTODO 3: Función completa de exportación")
                datos_completos = parsear_sesion_completa(raw_session)
                
                if datos_completos.get('has_laps', False):
                    print(f"✓ La función completa detectó {datos_completos.get('num_laps', 0)} laps:")
                    for lap in datos_completos.get('laps', []):
                        if not lap.get('error'):
                            print(f"  - Lap detectado con método: {lap.get('method', 'básico')}")
                        else:
                            print(f"  - Error: {lap.get('error')}")
                else:
                    print("⚠️ La función completa no detectó laps")
                
            except Exception as e:
                print(f"❌ Error procesando sesión {i}: {str(e)}")
                import traceback
                traceback.print_exc()
        
        # Resumen final
        print(f"\n{'='*80}")
        print("RESUMEN DE PRUEBAS")
        print(f"{'='*80}")
        print(f"✓ Se probaron 3 métodos de extracción de laps")
        print(f"✓ Se analizaron hasta 3 sesiones")
        print(f"\n💡 INTERPRETACIÓN DE RESULTADOS:")
        print(f"  - Si algún método detecta laps, el algoritmo funciona")
        print(f"  - Si ningún método detecta laps, puede ser que:")
        print(f"    • Las sesiones no tienen laps configurados")
        print(f"    • El formato de laps es diferente al esperado")
        print(f"    • Se necesita ajustar los algoritmos de detección")
        print(f"\n🚀 SIGUIENTE PASO:")
        print(f"  Ejecuta 'python exportar_para_dashboard.py' para generar")
        print(f"  el archivo JSON completo con la información de laps incluida.")
        
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
    probar_extraccion_laps()