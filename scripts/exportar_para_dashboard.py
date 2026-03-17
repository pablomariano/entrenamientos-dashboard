"""
Script para exportar sesiones de entrenamiento en formato JSON estructurado
para usar en un dashboard. Solo incluye duración y frecuencia cardíaca.
NO incluye GPS ni distancias (el reloj no tiene estas funcionalidades).
"""

import json
import math
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
import pytz
import tzlocal

# tzlocal >= 3.0 retorna ZoneInfo en lugar de un timezone de pytz,
# pero la librería llama .localize() que solo existe en pytz.
# Reemplazamos datetime_to_utc por una versión compatible.
def _datetime_to_utc_fixed(dt, timezone=None):
    if timezone is None:
        tz = pytz.timezone(str(tzlocal.get_localzone()))
    else:
        tz = pytz.timezone(timezone)
    return tz.localize(dt, is_dst=None).astimezone(pytz.utc)

utils.datetime_to_utc = _datetime_to_utc_fixed

# geopy lanza ValueError cuando lat/lon están fuera de rango (-90..90 / -180..180).
# En sesiones donde el GPS falló o los datos están corruptos esto mata el parsing
# completo, perdiendo todos los samples de HR. Parcheamos para ignorar el error.
def _safe_calculate_distance(self, coord1, coord2):
    try:
        lat1, lon1 = coord1
        lat2, lon2 = coord2
        if (lat1 is None or lon1 is None or lat2 is None or lon2 is None
                or abs(lat1) > 90 or abs(lon1) > 180
                or abs(lat2) > 90 or abs(lon2) > 180):
            return 0.0
        import geopy.distance
        return geopy.distance.distance(coord1, coord2).meters
    except Exception:
        return 0.0

TrainingSession._calculate_distance = _safe_calculate_distance

# Rango fisiológico válido de frecuencia cardíaca (bpm)
HR_MIN_VALID = 30
HR_MAX_VALID = 250

# Detección de laps sin GPS:
# Cuando el reloj registra un lap, inserta un bloque de 416 bits (casi todos ceros)
# en el stream entre muestras de HR. Detectamos esos bloques por su baja densidad.
LAP_DATA_BITS    = TrainingSession._LAP_DATA_BITS_LENGTH  # 416
LAP_DENSITY_MAX  = 0.15   # < 15% de bits en 1 → bloque de lap


def _hr_valido(hr):
    """Devuelve True si el valor de HR está en rango fisiológico válido."""
    if hr is None:
        return False
    return HR_MIN_VALID <= hr <= HR_MAX_VALID


def calcular_trimp(hr_samples, user_max_hr, user_resting_hr, sample_rate_seconds=5):
    """
    Calcula TRIMP (Training Impulse de Banister) para una sesión.
    TRIMP = Σ [ duracion_min × FC_rel × e^(1.92 × FC_rel) ]
    """
    if not hr_samples or user_max_hr is None or user_resting_hr is None:
        return None
    hr_range = user_max_hr - user_resting_hr
    if hr_range <= 0:
        return None

    duracion_min = sample_rate_seconds / 60.0
    acum = 0.0

    for s in hr_samples:
        hr = s.get('hr')
        if hr is None:
            continue
        fc_rel = (hr - user_resting_hr) / hr_range
        if fc_rel < 0:
            fc_rel = 0.0
        acum += duracion_min * fc_rel * math.exp(1.92 * fc_rel)

    trimp = round(acum, 1)
    if trimp < 50:
        level, desc = "bajo", "Recuperación o salida suave. Buen día para descanso activo."
    elif trimp <= 120:
        level, desc = "medio", "Sesión de carga moderada. Adecuada para desarrollo aeróbico."
    else:
        level, desc = "alto", "Sesión exigente. Prevé descanso y alimentación adecuada."

    return {"trimp": trimp, "level": level, "description": desc}


def detectar_laps_nogps(sess):
    """
    Escanea el stream de bits buscando bloques de lap (416 bits de baja densidad).

    Retorna (laps, laps_header, lap_bit_offsets) donde lap_bit_offsets es la
    lista de posiciones de bit donde comienza cada bloque de lap, necesaria
    para parchear el stream antes de llamar a sess.parse_samples().
    """
    bits        = sess._samples_bits
    sample_rate = sess.info.get('sample_rate', 5)
    cursor      = 0
    n_samples   = 0
    laps        = []
    lap_offsets = []  # posiciones de bit de cada bloque de lap

    def avanzar_muestra(pos):
        """Retorna cuántos bits consume la siguiente muestra HR (sin decodificar)."""
        if pos + 6 > len(bits):
            return 0
        p = bits[pos:pos+2]
        if p in ('01', '00'):
            if pos + 11 > len(bits): return 0
            return 11
        elif p in ('10', '11'):
            if pos + 6 > len(bits): return 0
            return 6
        return 0

    # Primera muestra
    consumed = avanzar_muestra(cursor)
    if consumed:
        cursor += consumed
        n_samples = 1

    while cursor < len(bits) - 6:
        if cursor + LAP_DATA_BITS <= len(bits):
            chunk   = bits[cursor:cursor + LAP_DATA_BITS]
            density = chunk.count('1') / LAP_DATA_BITS
            if density < LAP_DENSITY_MAX:
                t = n_samples * sample_rate
                laps.append({
                    'lap_number':     len(laps) + 1,
                    'time_seconds':   t,
                    'time_formatted': f"{t//3600:02d}:{(t%3600)//60:02d}:{t%60:02d}",
                })
                lap_offsets.append(cursor)
                cursor += LAP_DATA_BITS
                continue

        consumed = avanzar_muestra(cursor)
        if not consumed:
            break
        cursor    += consumed
        n_samples += 1

    try:
        laps_header = sess.raw[0][161]
    except (IndexError, TypeError):
        laps_header = None

    return laps, laps_header, lap_offsets


def filtrar_spikes_hr(muestras_hr, max_delta_bpm=40):
    """
    Descarta muestras con saltos de HR fisiológicamente imposibles.

    El bloque de lap (416 bits) es interpretado por sess.parse_samples() como
    un grupo de muestras con valores erróneos. Esas muestras producen saltos
    abruptos de decenas o cientos de bpm que no pueden ocurrir fisiológicamente
    en un intervalo de 5 segundos. Las descartamos por ese criterio.

    max_delta_bpm: salto máximo aceptable entre muestras consecutivas (bpm).
    """
    if not muestras_hr:
        return muestras_hr
    resultado = [muestras_hr[0]]
    for i in range(1, len(muestras_hr)):
        prev_hr = resultado[-1]['hr']
        curr_hr = muestras_hr[i]['hr']
        if abs(curr_hr - prev_hr) <= max_delta_bpm:
            resultado.append(muestras_hr[i])
        # Si el salto es imposible, omitir la muestra (no actualizar prev_hr
        # para no propagar el error a las siguientes)
    return resultado




def extraer_info_basica(raw_session):
    """Extrae información básica de una sesión sin parsear las muestras."""
    try:
        first_packet = raw_session[0]
        
        # Extraer información básica del header (similar a _parse_info)
        year = first_packet[44] + 1920
        month = first_packet[43]
        day = first_packet[42]
        hour = bcd_to_int(first_packet[41])
        minute = bcd_to_int(first_packet[40])
        second = bcd_to_int(first_packet[39])
        
        duration_hours = bcd_to_int(first_packet[38])
        duration_minutes = bcd_to_int(first_packet[37])
        duration_seconds = bcd_to_int(first_packet[36])
        
        has_hr = bool(first_packet[165])
        has_gps = bool(first_packet[166])
        
        # HR stats (si están disponibles)
        hr_avg = first_packet[201] if has_hr else None
        hr_max = first_packet[205] if has_hr else None
        hr_min = first_packet[203] if has_hr else None
        
        start_time = datetime(year, month, day, hour, minute, second)
        duration_total = duration_hours * 3600 + duration_minutes * 60 + duration_seconds
        
        return {
            'start_time': start_time.isoformat(),
            'duration_seconds': duration_total,
            'duration_formatted': f"{duration_hours:02d}:{duration_minutes:02d}:{duration_seconds:02d}",
            'has_hr': has_hr,
            'hr_avg': hr_avg,
            'hr_max': hr_max,
            'hr_min': hr_min,
        }
    except Exception as e:
        return {
            'error': str(e),
            'parseable': False
        }


def parsear_sesion_completa(raw_session):
    """Extrae solo información de duración y frecuencia cardíaca, incluyendo muestras de HR."""
    try:
        sess = TrainingSession(raw_session)

        # El byte 166 del protocolo queda en True aunque el reloj no tenga GPS.
        # El parser GPS intenta leer coordenadas/velocidad/satélites donde solo
        # hay datos de HR, produciendo crashes o samples truncados. Forzamos
        # modo no-GPS y recalculamos el inicio del stream de bits (351 vs 349).
        if sess.has_gps:
            sess.has_gps = False
            sess._samples_bits = sess._get_samples_bits()

        # Detectar laps (posición en tiempo), luego parsear HR con la librería
        # y filtrar spikes fisiológicamente imposibles producidos por los bloques
        # de lap que sess.parse_samples() no conoce y malinterpreta.
        muestras_hr = []
        muestras_parseadas = False
        laps_detectados = []
        laps_header = None

        try:
            laps_detectados, laps_header, _ = detectar_laps_nogps(sess)
        except Exception:
            pass

        if sess.has_hr:
            try:
                sess.parse_samples()
                muestras_parseadas = True

                sample_rate = sess.info.get('sample_rate', 5)
                start_time = sess.start_time
                max_seconds = sess.duration

                muestras_raw = []
                for i, sample in enumerate(sess.samples):
                    seconds_from_start = i * sample_rate
                    if seconds_from_start >= max_seconds:
                        break
                    if sample.hr is not None and _hr_valido(sample.hr):
                        timestamp = start_time.timestamp() + seconds_from_start
                        muestras_raw.append({
                            'timestamp': timestamp,
                            'time_seconds': seconds_from_start,
                            'time_formatted': f"{seconds_from_start // 60:02d}:{seconds_from_start % 60:02d}",
                            'hr': sample.hr
                        })

                muestras_hr = filtrar_spikes_hr(muestras_raw)
            except Exception:
                muestras_parseadas = False
        
        # Construir datos estructurados - SOLO HR y duración
        datos = {
            'id': sess.id,
            'start_time': sess.start_time.isoformat(),
            'start_utctime': sess.start_utctime.isoformat() if sess.start_utctime else None,
            'duration_seconds': sess.duration,
            'duration_formatted': f"{sess.duration // 3600:02d}:{(sess.duration % 3600) // 60:02d}:{sess.duration % 60:02d}",
            'has_hr': sess.has_hr,
        }
        
        # Información de HR (estadísticas) - solo valores en rango válido 30-250 bpm
        if sess.has_hr:
            hr_avg = sess.info.get('hr_avg')
            hr_max = sess.info.get('hr_max')
            hr_min = sess.info.get('hr_min')
            datos['hr_avg'] = hr_avg if _hr_valido(hr_avg) else None
            datos['hr_max'] = hr_max if _hr_valido(hr_max) else None
            datos['hr_min'] = hr_min if _hr_valido(hr_min) else None
            datos['sample_rate_seconds'] = sess.info.get('sample_rate', 5)
            datos['user_hr_max'] = sess.info.get('user_hr_max')
            datos['user_hr_rest'] = sess.info.get('user_hr_rest')
        else:
            datos['hr_avg'] = None
            datos['hr_max'] = None
            datos['hr_min'] = None
            datos['sample_rate_seconds'] = None
            datos['user_hr_max'] = None
            datos['user_hr_rest'] = None
        
        # Incluir muestras de HR para gráficos de evolución
        if muestras_parseadas and muestras_hr:
            datos['hr_samples'] = muestras_hr
            datos['num_hr_samples'] = len(muestras_hr)
        else:
            datos['hr_samples'] = []
            datos['num_hr_samples'] = 0

        # Laps y header (ya detectados por parsear_stream_hr)
        datos['laps']       = laps_detectados
        datos['num_laps']   = len(laps_detectados)
        datos['has_laps']   = len(laps_detectados) > 0
        if laps_header is not None:
            datos['num_laps_header'] = laps_header

        # Cálculo TRIMP (Training Impulse de Banister)
        if muestras_hr:
            user_max  = datos.get('user_hr_max') or datos.get('hr_max')
            user_rest = datos.get('user_hr_rest') or 60
            sr        = datos.get('sample_rate_seconds', 5)
            if user_max is not None and user_rest is not None and user_max > user_rest:
                datos['trimp'] = calcular_trimp(muestras_hr, user_max, user_rest, sr)
            else:
                datos['trimp'] = None
        else:
            datos['trimp'] = None

        return datos
        
    except Exception:
        # Si falla el parsing, devolver solo la información básica del header
        datos_basicos = extraer_info_basica(raw_session)
        datos_basicos['laps'] = []
        datos_basicos['num_laps'] = 0
        datos_basicos['has_laps'] = False
        datos_basicos['trimp'] = None
        return datos_basicos


def pedir_filtro_meses():
    """Pregunta al usuario cuántos meses hacia atrás exportar. Retorna None para todo."""
    print("\nFiltro de fecha:")
    print("  0  = Exportar TODAS las sesiones")
    print("  N  = Exportar solo los últimos N meses (ej: 2, 6, 12)")
    while True:
        respuesta = input("¿Cuántos meses? [0 para todas]: ").strip()
        if respuesta == '' or respuesta == '0':
            return None
        try:
            meses = int(respuesta)
            if meses > 0:
                return meses
            print("  Ingresá un número mayor a 0, o 0 para todas.")
        except ValueError:
            print("  Valor inválido. Ingresá un número entero.")


def fecha_limite(meses):
    """Retorna el primer día del mes que resulta de restar N meses a hoy."""
    hoy = datetime.now()
    total_meses = hoy.year * 12 + (hoy.month - 1) - meses
    anio_destino = total_meses // 12
    mes_destino = total_meses % 12 + 1
    return hoy.replace(year=anio_destino, month=mes_destino, day=1,
                       hour=0, minute=0, second=0, microsecond=0)


def sesion_dentro_del_filtro(datos, limite):
    """Retorna True si la sesión está dentro del período a exportar."""
    if limite is None:
        return True
    start_str = datos.get('start_time')
    if not start_str:
        return True
    try:
        start = datetime.fromisoformat(start_str)
        return start >= limite
    except ValueError:
        return True


def main():
    print("="*80)
    print("EXPORTADOR PARA DASHBOARD - Polar RCX5")
    print("="*80)
    print("\nEste script exporta sesiones de entrenamiento en formato JSON estructurado.\n")

    filtro_meses = pedir_filtro_meses()
    limite_fecha = fecha_limite(filtro_meses) if filtro_meses else None

    if limite_fecha:
        print(f"\n  → Exportando sesiones desde {limite_fecha.strftime('%d/%m/%Y')} en adelante")
    else:
        print("\n  → Exportando TODAS las sesiones")

    input("\nPresiona ENTER cuando hayas seleccionado 'Connect > Start synchronizing' en tu reloj...")
    
    output_dir = Path(r'C:\Users\Pablo\Desktop\entrenamientos_dashboard')
    output_dir.mkdir(exist_ok=True)
    
    try:
        # Sincronizar con el reloj
        print("\n[1/3] Sincronizando con el reloj...")
        with DataLink() as dl:
            dl.synchronize()
            raw_sessions = dl.sessions
        
        print(f"✓ Sincronización completada: {len(raw_sessions)} sesiones encontradas")
        
        # Procesar cada sesión
        print(f"\n[2/3] Procesando sesiones...")
        todas_las_sesiones = []
        sesiones_omitidas = 0
        
        for i, raw_session in enumerate(raw_sessions, 1):
            print(f"  Procesando sesión {i}/{len(raw_sessions)}...", end=' ')
            
            datos = parsear_sesion_completa(raw_session)

            if not sesion_dentro_del_filtro(datos, limite_fecha):
                sesiones_omitidas += 1
                fecha = datos.get('start_time', '?')[:10]
                print(f"omitida (fuera del período: {fecha})")
                continue

            todas_las_sesiones.append(datos)
            print("✓")
        
        # Guardar en archivo JSON
        print(f"\n[3/3] Guardando datos...")
        output_file = output_dir / 'entrenamientos.json'

        resultado = {
            'export_date': datetime.now().isoformat(),
            'filter_months': filtro_meses,
            'filter_from': limite_fecha.isoformat() if limite_fecha else None,
            'total_sessions': len(todas_las_sesiones),
            'sessions': todas_las_sesiones
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(resultado, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Datos guardados en: {output_file}")
        
        # Resumen
        print(f"\n{'='*80}")
        print("RESUMEN")
        print(f"{'='*80}")
        if filtro_meses:
            print(f"Período:           últimos {filtro_meses} mes(es) (desde {limite_fecha.strftime('%d/%m/%Y')})")
        else:
            print(f"Período:           todas las sesiones")
        print(f"Sesiones incluidas:{len(todas_las_sesiones)}")
        if sesiones_omitidas:
            print(f"Sesiones omitidas: {sesiones_omitidas} (fuera del período)")
        print(f"\nArchivo JSON: {output_file}")
        
        # Mostrar estadísticas de laps
        sesiones_con_laps = sum(1 for s in todas_las_sesiones if s.get('has_laps', False))
        total_laps = sum(s.get('num_laps', 0) for s in todas_las_sesiones)
        
        if sesiones_con_laps > 0:
            print(f"\n📊 INFORMACIÓN DE LAPS:")
            print(f"  - Sesiones con laps detectados: {sesiones_con_laps}")
            print(f"  - Total de laps encontrados: {total_laps}")
            print(f"  - Promedio de laps por sesión: {total_laps/sesiones_con_laps:.1f}")
        else:
            print(f"\n⚠️ No se detectaron laps en las sesiones procesadas.")
            print(f"   Esto puede deberse a:")
            print(f"   - Las sesiones no tienen laps configurados")
            print(f"   - Los datos de laps están en un formato no reconocido")
            print(f"   - Limitaciones en el algoritmo de detección")
        
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
