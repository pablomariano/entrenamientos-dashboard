"""
patches.py — Monkey-patches en runtime para polar-rcx5-datalink.

Por qué existen:
  1. _ERROR_TIMEOUT_CODE: la librería usa errno 10060 en Windows para detectar
     timeout de socket, pero el valor hardcodeado en datalink.py es el de POSIX
     (110). Sobreescribir en runtime evita tocar archivos de site-packages.

  2. datetime_to_utc: tzlocal >= 3.0 retorna ZoneInfo en lugar de un timezone
     de pytz, pero la librería llama .localize() que solo existe en objetos pytz.
     Reemplazamos la función por una versión que convierte explícitamente.

  3. _calculate_distance: geopy lanza ValueError cuando lat/lon están fuera del
     rango válido (-90..90 / -180..180). Sesiones con GPS corrupto o sin GPS
     provocan que parse_samples() falle antes de leer cualquier sample de HR.
     Envolvemos el cálculo para devolver 0.0 en lugar de lanzar.

Uso:
    import patches
    patches.apply_patches()
"""

import pytz
import tzlocal

import polar_rcx5_datalink.datalink as _datalink
import polar_rcx5_datalink.utils as _utils
from polar_rcx5_datalink.parser import TrainingSession


def apply_patches():
    """Aplica los tres patches en runtime. Idempotente: se puede llamar más de una vez."""
    _apply_timeout_patch()
    _apply_tzlocal_patch()
    _apply_distance_patch()


# ---------------------------------------------------------------------------
# Patch 1: timeout de socket en Windows
# ---------------------------------------------------------------------------

def _apply_timeout_patch():
    # En Windows, WinSock usa el código 10060 (WSAETIMEDOUT) para indicar
    # timeout, mientras que POSIX usa 110 (ETIMEDOUT). La librería compara
    # e.errno contra _ERROR_TIMEOUT_CODE para decidir si reintentar; si el
    # código es incorrecto simplemente lanza SyncError en lugar de esperar.
    _datalink._ERROR_TIMEOUT_CODE = 10060


# ---------------------------------------------------------------------------
# Patch 2: compatibilidad tzlocal >= 3.0
# ---------------------------------------------------------------------------

def _datetime_to_utc_fixed(dt, timezone=None):
    if timezone is None:
        tz = pytz.timezone(str(tzlocal.get_localzone()))
    else:
        tz = pytz.timezone(timezone)
    return tz.localize(dt, is_dst=None).astimezone(pytz.utc)


def _apply_tzlocal_patch():
    _utils.datetime_to_utc = _datetime_to_utc_fixed


# ---------------------------------------------------------------------------
# Patch 3: geopy con coordenadas fuera de rango
# ---------------------------------------------------------------------------

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


def _apply_distance_patch():
    TrainingSession._calculate_distance = _safe_calculate_distance
