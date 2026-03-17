# Plan: Rehacer el Software Desde Cero (Enfoque Biblioteca Original)

Reconstruir el pipeline Python partiendo del uso directo de `polar-rcx5-datalink` sin modificaciones a la librería, guardando los datos en formato raw (pickle + JSON) y derivando los datos para el dashboard desde ahí.

---

## Decisiones

| Pregunta | Decisión |
|---|---|
| Formato raw | **Ambos**: pickle (fuente de verdad, copia fiel) + JSON (respaldo portable) |
| Alcance | **Solo Python** por ahora; dashboard después |
| Compatibilidad hacia atrás | **No necesaria** — el historial está en el reloj |

---

## Contexto: Problemas del Diseño Actual

1. Fixes manuales en `site-packages` (frágiles, se rompen al reinstalar pip):
   - `datalink.py`: `_ERROR_TIMEOUT_CODE = 10060` (Windows)
   - `utils.py`: `pop_zeroes()` con `StopIteration`
   - `parser.py`: forzar `has_gps = False`
2. Monkey-patches en runtime mezclados con lógica de negocio en un solo script
3. No hay separación entre "descargar" y "procesar" — si falla el procesamiento hay que reconectar el reloj

---

## Plan

### Fase 1 — Script de Descarga Raw
**Archivo**: `scripts/descargar_raw.py`

- Aplica solo los 2 patches mínimos e inevitables en runtime (timeout Windows + `tzlocal`):
  - `_ERROR_TIMEOUT_CODE = 10060` vía monkey-patch (no tocar archivos de pip)
  - `utils.datetime_to_utc` reemplazado por versión compatible con `tzlocal >= 3.0`
- Conecta con `DataLink`, llama a `dl.synchronize()`, accede a `dl.sessions`
- **Sin ningún procesamiento**: guarda los raw bytes tal cual
- Salida:
  - `data/raw_sessions.pkl` — pickle de `list[list[bytes]]`, copia exacta
  - `data/raw_sessions.json` — misma estructura con bytes como listas de enteros (portable)
- Reporta: N sesiones descargadas, tamaño de cada paquete

### Fase 2 — Script de Exploración (offline, sin reloj)
**Archivo**: `scripts/explorar_raw.py`

- Carga `data/raw_sessions.pkl`
- Para cada sesión, intenta usar la librería **sin patches** y **con patches**:
  - `TrainingSession(raw)` → qué queda en `sess.info`
  - `sess.parse_samples()` → qué lanza excepción y en qué punto
  - Comparar `sess.info` con los valores del header leídos directamente (offsets conocidos)
- Produce un reporte en consola: qué funciona, qué falla, diferencias de HR avg/max/min

### Fase 3 — Procesador Limpio
**Archivo**: `scripts/procesar_sesiones.py`

- Carga `data/raw_sessions.pkl`
- Patches en runtime en un módulo separado `scripts/patches.py` (bien documentados)
- Extrae: duración, HR stats, muestras de HR, laps, TRIMP
- Produce `data/entrenamientos.json` (formato a definir luego del dashboard refactor)

### Fase 4 — Dashboard (posterior)
- Rediseñar el formato de `entrenamientos.json` según las necesidades del nuevo dashboard
- Migrar el frontend Next.js al nuevo formato
