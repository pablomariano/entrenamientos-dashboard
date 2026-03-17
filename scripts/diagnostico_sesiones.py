"""
Script de diagnóstico para investigar por qué algunas sesiones no se pueden parsear.
"""

import sys
import traceback
from pathlib import Path

# Agregar el path de la librería instalada
sys.path.insert(0, r'C:\Users\Pablo\AppData\Local\Programs\Python\Python314\Lib\site-packages')

from polar_rcx5_datalink.datalink import DataLink
from polar_rcx5_datalink.parser import TrainingSession
from polar_rcx5_datalink.exceptions import ParserError, SyncError


def analizar_sesion(raw_session, session_id):
    """Analiza una sesión y muestra información detallada sobre posibles problemas."""
    print(f"\n{'='*80}")
    print(f"Analizando sesión: {session_id}")
    print(f"{'='*80}")
    
    try:
        # Crear objeto TrainingSession
        sess = TrainingSession(raw_session)
        
        print(f"✓ Sesión creada exitosamente")
        print(f"  - Fecha inicio: {sess.start_time}")
        print(f"  - Duración: {sess.duration} segundos")
        print(f"  - Tiene HR: {sess.has_hr}")
        print(f"  - Tiene GPS: {sess.has_gps}")
        print(f"  - Número de paquetes: {len(sess.raw)}")
        
        # Calcular tamaño total
        total_bytes = sum(len(packet) for packet in sess.raw)
        print(f"  - Tamaño total: {total_bytes} bytes")
        
        # Analizar estructura de paquetes
        print(f"\n  Estructura de paquetes:")
        for i, packet in enumerate(sess.raw):
            print(f"    Paquete {i+1}: {len(packet)} bytes")
            if i == 0:
                print(f"      Primeros 20 bytes: {packet[:20]}")
        
        # Intentar obtener bits de muestras
        print(f"\n  Intentando obtener bits de muestras...")
        samples_bits = sess._get_samples_bits()
        print(f"  ✓ Bits de muestras obtenidos: {len(samples_bits)} bits ({len(samples_bits)//8} bytes)")
        
        if len(samples_bits) == 0:
            print(f"  ⚠ ADVERTENCIA: No hay bits de muestras (sesión vacía?)")
            return False
        
        # Intentar parsear muestras
        print(f"\n  Intentando parsear muestras...")
        try:
            sess.parse_samples()
            print(f"  ✓ Muestras parseadas exitosamente: {len(sess.samples)} muestras")
            if len(sess.samples) > 0:
                print(f"    Primera muestra: HR={sess.samples[0].hr}, Lat={sess.samples[0].lat}, Lon={sess.samples[0].lon}")
            return True
        except Exception as e:
            print(f"  ✗ ERROR al parsear muestras:")
            print(f"    Tipo: {type(e).__name__}")
            print(f"    Mensaje: {str(e)}")
            
            # Mostrar información adicional si está disponible
            if hasattr(e, 'error_info'):
                print(f"\n    Información detallada del error:")
                for key, value in e.error_info.items():
                    print(f"      {key}: {value}")
            
            # Información adicional sobre el estado del cursor
            if hasattr(sess, '_cursor'):
                print(f"\n    Estado del cursor: {sess._cursor}/{len(samples_bits)}")
                if sess._cursor < len(samples_bits):
                    remaining = min(100, len(samples_bits) - sess._cursor)
                    print(f"    Próximos {remaining} bits: {samples_bits[sess._cursor:sess._cursor+remaining]}")
                else:
                    print(f"    ⚠ El cursor está al final de los bits disponibles")
            
            # Mostrar información sobre las muestras ya parseadas
            if hasattr(sess, 'samples') and len(sess.samples) > 0:
                print(f"\n    Muestras parseadas antes del error: {len(sess.samples)}")
                print(f"    Última muestra exitosa:")
                last = sess.samples[-1]
                print(f"      HR={last.hr}, Lat={last.lat}, Lon={last.lon}")
            
            print(f"\n    Traceback completo:")
            traceback.print_exc()
            
            return False
            
    except Exception as e:
        print(f"✗ ERROR al crear o analizar la sesión:")
        print(f"  Tipo: {type(e).__name__}")
        print(f"  Mensaje: {str(e)}")
        print(f"\n  Traceback completo:")
        traceback.print_exc()
        return False


def main():
    print("="*80)
    print("DIAGNÓSTICO DE SESIONES POLAR RCX5")
    print("="*80)
    print("\nEste script intentará sincronizar con el reloj y analizar")
    print("las sesiones que no se pueden parsear correctamente.\n")
    
    input("Presiona ENTER cuando hayas seleccionado 'Connect > Start synchronizing' en tu reloj...")
    
    try:
        # Sincronizar con el reloj
        print("\n[1/2] Sincronizando con el reloj...")
        with DataLink() as dl:
            dl.synchronize()
            raw_sessions = dl.sessions
        
        print(f"✓ Sincronización completada: {len(raw_sessions)} sesiones encontradas")
        
        # Analizar cada sesión
        print(f"\n[2/2] Analizando sesiones...")
        sesiones_problematicas = []
        sesiones_exitosas = []
        
        for raw_session in raw_sessions:
            # Crear sesión temporal para obtener el ID
            try:
                sess_temp = TrainingSession(raw_session)
                session_id = sess_temp.id
            except:
                session_id = "DESCONOCIDA"
            
            if analizar_sesion(raw_session, session_id):
                sesiones_exitosas.append(session_id)
            else:
                sesiones_problematicas.append(session_id)
        
        # Resumen
        print(f"\n{'='*80}")
        print("RESUMEN")
        print(f"{'='*80}")
        print(f"Total de sesiones: {len(raw_sessions)}")
        print(f"✓ Sesiones exitosas: {len(sesiones_exitosas)}")
        print(f"✗ Sesiones problemáticas: {len(sesiones_problematicas)}")
        
        if sesiones_problematicas:
            print(f"\nSesiones problemáticas:")
            for sid in sesiones_problematicas:
                print(f"  - {sid}")
        
    except SyncError as e:
        print(f"\n✗ Error de sincronización: {e}")
        print("Asegúrate de que:")
        print("  1. El dongle DataLink está conectado")
        print("  2. Has seleccionado 'Connect > Start synchronizing' en el reloj")
        print("  3. El reloj está cerca del dongle")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\nOperación cancelada por el usuario")
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ Error inesperado: {e}")
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
