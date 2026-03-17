"""
Script para analizar una sesión específica y verificar la coherencia de los datos,
especialmente la distancia calculada.
"""

import sys
from datetime import datetime

# Agregar el path de la librería instalada
sys.path.insert(0, r'C:\Users\Pablo\AppData\Local\Programs\Python\Python314\Lib\site-packages')

from polar_rcx5_datalink.datalink import DataLink
from polar_rcx5_datalink.parser import TrainingSession, Sample
from polar_rcx5_datalink.exceptions import SyncError, ParserError
import geopy.distance


def analizar_distancia(sess):
    """Analiza cómo se calcula la distancia en una sesión."""
    print("\n" + "="*80)
    print("ANÁLISIS DE DISTANCIA")
    print("="*80)
    
    print(f"\n📊 Información de la sesión:")
    print(f"  - ID: {sess.id}")
    print(f"  - Fecha: {sess.start_time}")
    print(f"  - Duración: {sess.duration} segundos ({sess.duration/60:.1f} minutos)")
    print(f"  - Tiene GPS: {sess.has_gps}")
    print(f"  - Tiene HR: {sess.has_hr}")
    print(f"  - Sample rate: {sess.info.get('sample_rate', 'N/A')} segundos")
    
    if not sess.has_gps:
        print("\n✅ Esta sesión NO tiene datos GPS.")
        print("   La distancia NO se calcula sin GPS (correcto).")
        if hasattr(sess, 'distance') and sess.distance > 0:
            print(f"   ⚠️ PERO la distancia reportada es: {sess.distance:.2f}m")
            print(f"   Esto es un ERROR - debería ser 0")
        return
    
    print(f"\n📍 Coordenadas GPS:")
    if len(sess.samples) > 0:
        first = sess.samples[0]
        last = sess.samples[-1]
        print(f"  - Primera muestra: Lat={first.lat:.7f}, Lon={first.lon:.7f}")
        print(f"  - Última muestra: Lat={last.lat:.7f}, Lon={last.lon:.7f}")
        
        # Calcular distancia entre primera y última
        distancia_directa = geopy.distance.distance(
            (first.lat, first.lon),
            (last.lat, last.lon)
        ).meters
        
        print(f"\n📏 Distancia calculada:")
        print(f"  - Distancia total acumulada: {sess.distance:.2f} metros ({sess.distance/1000:.2f} km)")
        print(f"  - Distancia en línea recta (primera-última): {distancia_directa:.2f} metros ({distancia_directa/1000:.2f} km)")
        print(f"  - Número de muestras: {len(sess.samples)}")
        
        # Verificar coherencia
        if sess.distance > 0:
            print(f"\n✅ La distancia se calcula sumando la distancia entre muestras consecutivas")
            print(f"   usando coordenadas GPS (geopy.distance).")
            
            # Analizar algunas muestras
            print(f"\n🔍 Análisis de muestras:")
            print(f"  - Muestras analizadas: {min(10, len(sess.samples))} primeras")
            
            distancia_acumulada = 0
            for i in range(min(10, len(sess.samples))):
                if i > 0:
                    prev = sess.samples[i-1]
                    curr = sess.samples[i]
                    dist_segmento = geopy.distance.distance(
                        (prev.lat, prev.lon),
                        (curr.lat, curr.lon)
                    ).meters
                    distancia_acumulada += dist_segmento
                    print(f"    Muestra {i+1}: Distancia desde anterior = {dist_segmento:.2f}m")
            
            # Verificar si las coordenadas son realistas
            print(f"\n🌍 Verificación de coordenadas:")
            coordenadas_validas = True
            
            # Verificar rango de latitud (-90 a 90)
            for i, sample in enumerate(sess.samples[:10]):
                if not (-90 <= sample.lat <= 90):
                    print(f"  ⚠️ Latitud inválida en muestra {i+1}: {sample.lat}")
                    coordenadas_validas = False
                if not (-180 <= sample.lon <= 180):
                    print(f"  ⚠️ Longitud inválida en muestra {i+1}: {sample.lon}")
                    coordenadas_validas = False
            
            if coordenadas_validas:
                print(f"  ✅ Todas las coordenadas están en rangos válidos")
            
            # Verificar si las coordenadas están en el mismo lugar (GPS no funcionaba)
            if len(sess.samples) > 1:
                primera_lat = sess.samples[0].lat
                primera_lon = sess.samples[0].lon
                
                # Verificar si todas las coordenadas son iguales
                muestras_con_coords = [s for s in sess.samples if s.lat is not None and s.lon is not None]
                if len(muestras_con_coords) > 1:
                    todas_iguales = all(
                        abs(s.lat - primera_lat) < 0.0001 and abs(s.lon - primera_lon) < 0.0001
                        for s in muestras_con_coords[:min(20, len(muestras_con_coords))]
                    )
                    
                    if todas_iguales:
                        print(f"\n⚠️ ADVERTENCIA CRÍTICA: Las coordenadas GPS están fijas (mismo punto)")
                        print(f"   Esto indica que:")
                        print(f"   - El GPS NO estaba funcionando correctamente")
                        print(f"   - El entrenamiento fue probablemente en interiores")
                        print(f"   - La distancia calculada ({sess.distance:.2f}m) NO es confiable")
                        print(f"   - Debería ser 0 o marcarse como 'no disponible'")
                    else:
                        # Calcular variación promedio
                        variaciones = []
                        for i in range(1, min(20, len(muestras_con_coords))):
                            prev = muestras_con_coords[i-1]
                            curr = muestras_con_coords[i]
                            dist = geopy.distance.distance(
                                (prev.lat, prev.lon),
                                (curr.lat, curr.lon)
                            ).meters
                            variaciones.append(dist)
                        
                        if variaciones:
                            variacion_promedio = sum(variaciones) / len(variaciones)
                            print(f"\n✅ Las coordenadas GPS varían")
                            print(f"   Variación promedio entre muestras: {variacion_promedio:.2f}m")
                            
                            if variacion_promedio < 1.0:
                                print(f"   ⚠️ La variación es muy pequeña - posible GPS de baja calidad")
                else:
                    print(f"\n⚠️ No hay suficientes muestras con coordenadas para validar")
        else:
            print(f"\n⚠️ La distancia calculada es 0")
            print(f"   Esto podría indicar que las coordenadas no cambiaron")
    else:
        print("\n⚠️ No hay muestras parseadas en esta sesión")


def main():
    fecha_buscada = "2026-02-10"
    
    print("="*80)
    print("ANÁLISIS DE SESIÓN ESPECÍFICA")
    print("="*80)
    print(f"\nBuscando sesión del {fecha_buscada}")
    print("\nIMPORTANTE: Este script analiza cómo se calcula la distancia.")
    print("La distancia se calcula usando coordenadas GPS entre muestras consecutivas,")
    print("NO viene directamente del reloj.\n")
    
    input("Presiona ENTER cuando hayas seleccionado 'Connect > Start synchronizing' en tu reloj...")
    
    try:
        # Sincronizar con el reloj
        print("\n[1/2] Sincronizando con el reloj...")
        with DataLink() as dl:
            dl.synchronize()
            raw_sessions = dl.sessions
        
        print(f"✓ Sincronización completada: {len(raw_sessions)} sesiones encontradas")
        
        # Buscar la sesión específica
        print(f"\n[2/2] Buscando sesión del {fecha_buscada}...")
        sesion_encontrada = None
        
        for raw_session in raw_sessions:
            try:
                sess = TrainingSession(raw_session)
                if fecha_buscada in sess.id or fecha_buscada in str(sess.start_time):
                    sesion_encontrada = sess
                    # Intentar parsear muestras
                    try:
                        sess.parse_samples()
                    except:
                        pass
                    break
            except:
                continue
        
        if sesion_encontrada:
            print(f"✓ Sesión encontrada: {sesion_encontrada.id}")
            analizar_distancia(sesion_encontrada)
            
            # Mostrar información adicional
            print(f"\n" + "="*80)
            print("INFORMACIÓN ADICIONAL")
            print("="*80)
            print(f"\n💡 Cómo funciona el cálculo de distancia:")
            print(f"   1. El reloj Polar RCX5 guarda coordenadas GPS en cada muestra")
            print(f"   2. El parser calcula la distancia entre muestras consecutivas")
            print(f"   3. Usa la fórmula de Haversine (geopy.distance) para calcular")
            print(f"      la distancia en línea recta entre dos puntos GPS")
            print(f"   4. Suma todas las distancias entre muestras para obtener la total")
            print(f"\n⚠️ Limitaciones:")
            print(f"   - Si el GPS no funcionaba bien, las coordenadas pueden ser incorrectas")
            print(f"   - Si las coordenadas están fijas (mismo punto), distancia = 0")
            print(f"   - La distancia es en línea recta entre puntos, no la ruta real")
            print(f"   - Si no hay GPS, NO debería haber distancia")
            
        else:
            print(f"✗ No se encontró ninguna sesión del {fecha_buscada}")
            print(f"\nSesiones disponibles:")
            for raw_session in raw_sessions[:5]:  # Mostrar primeras 5
                try:
                    sess = TrainingSession(raw_session)
                    print(f"  - {sess.id} ({sess.start_time})")
                except:
                    print(f"  - (sesión no parseable)")
        
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
