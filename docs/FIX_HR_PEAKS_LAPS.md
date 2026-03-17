# Fix: Picos de HR causados por bloques de lap (Polar RCX5)

## Resumen

El dashboard mostraba picos anómalos de frecuencia cardíaca (HR) justo antes o después de los marcadores de lap. Luego de análisis iterativo, se identificó que la causa raíz era la **interpretación errónea de los bloques de metadata de lap** por parte del parser de la librería `polar_rcx5_datalink`. La solución final fue un **parser HR single-pass** que detecta y descarta esos bloques usando el mismo cursor que usa para decodificar HR, evitando cualquier desfase.

---

## Causa raíz

Cuando el usuario presiona el botón de lap en el reloj Polar RCX5, el reloj **inserta un bloque de 416 bits** (casi todos ceros) en medio del stream binario de muestras HR. Este bloque contiene metadata del lap (tiempo parcial, etc.) pero está en un formato completamente diferente al de las muestras HR.

El método `sess.parse_samples()` de la librería **no tiene conocimiento de estos bloques** y los decodifica como si fueran muestras HR normales, produciendo:

- Valores delta acumulados incorrectos (bajadas a 30 bpm, subidas a 250 bpm)
- Spikes y drops visuales en el gráfico alrededor de cada lap

Las sesiones **sin laps** nunca presentaron este problema porque su stream es homogéneo de principio a fin.

---

## Análisis del stream de bits

El formato de codificación HR del RCX5 usa 4 tipos de muestra identificados por un prefijo de 2 bits:

| Prefijo | Tipo              | Bits totales | Decodificación                             |
|---------|-------------------|--------------|--------------------------------------------|
| `01`    | Full con prefijo  | 11           | `int(bits[pos+3:pos+11], 2)` → 8 bits      |
| `00`    | Full prefixless   | 11           | `int(bits[pos:pos+11], 2)` → 11 bits       |
| `10`    | Delta positivo    | 6            | `int(bits[pos+2:pos+6], 2)`                |
| `11`    | Delta negativo    | 6            | Complemento a 2 de `bits[pos+2:pos+6]`     |

La librería también implementa **frozen fields**: si hay 2 deltas cero consecutivos, el campo se "congela" y avanza **1 bit** por ciclo en lugar de 6 u 11, hasta recibir un valor full (`01`). Este comportamiento es crítico para mantener la sincronización del cursor.

---

## Enfoques intentados y por qué fallaron

### Enfoque 1: Parser HR custom que salta bloques de lap
**Idea:** detectar posiciones de lap con `detectar_laps_nogps()`, luego en el parser saltar esos 416 bits completamente.

**Problema:** `detectar_laps_nogps()` usa `avanzar_muestra()` que siempre avanza 6 u 11 bits. La librería avanza **1 bit** cuando el campo está frozen. Si había muestras frozen antes del lap, el cursor de detección quedaba adelantado respecto al cursor real del decoder.

**Resultado:** desfase de ~42 bits → los rangos de exclusión estaban corridos → algunos bits del bloque de lap se leían como HR válido.

```
Librería detectó lap en: bit 8190
Posición real del bloque: bit 8232
Desfase: 42 bits
```

### Enfoque 2: Leer el bloque de lap pero marcar muestras como None
**Idea:** en lugar de saltar, leer el bloque normalmente pero marcar todas sus muestras como `None`.

**Problema:** el mismo desfase de cursor persistía porque los rangos de lap seguían viniendo de `detectar_laps_nogps()`.

### Enfoque 3 (Anterior, en `exportar_para_dashboard.py`): `filtrar_zona_laps`
**Idea:** post-procesamiento con zona de exclusión temporal (±20s alrededor de cada lap) + filtro de spikes (>50 bpm entre muestras consecutivas).

**Problema:** creaba huecos grandes en los datos. El frontend conectaba los extremos del hueco con una línea recta, generando un spike visual artificial más grande que el original.

---

## Solución final: Parser single-pass

El parser `parsear_hr_custom()` en `scripts/procesar_sesiones.py` combina la detección de laps y el parsing de HR en **un único loop con un único cursor**, garantizando que nunca puede haber desfase.

### Algoritmo

```
cursor = 0, last_hr = None, zero_delta_count = 0, is_frozen = False

LOOP mientras cursor < len(bits):
    
    SI los próximos 416 bits tienen densidad < 0.15 (bloque de lap):
        → leer todo el bloque manteniendo estado (last_hr, frozen)
        → marcar todas las muestras como None (descartadas)
        → avanzar cursor hasta el fin exacto del bloque
        → continuar
    
    SI is_frozen Y prefijo != '01':
        → hr = last_hr, consumed = 1  (avanzar 1 bit, igual que la librería)
    SI NO:
        → decodificar HR según prefijo ('01', '00', '10', '11')
        → actualizar zero_delta_count e is_frozen
    
    SI hr es válido Y no dentro de lap:
        → agregar a hr_values
```

### Resultado de validación

```
PARSER LIBRERÍA:
  Muestras: 1661 | HR min: 30 | HR max: 250 | Extremos: 7

PARSER CUSTOM:
  Muestras: 1608 | HR min: 57 | HR max: 135 | Extremos: 0

Primeras 20 muestras: 20/20 coinciden exactamente ✓
```

---

## Archivos modificados

### `scripts/procesar_sesiones.py`

| Función                      | Cambio                                                                                       |
|------------------------------|----------------------------------------------------------------------------------------------|
| `filtrar_spikes_hr()`        | **Eliminada** — ya no necesaria                                                              |
| `_decodificar_hr_muestra()`  | **Nueva** — replica `_process_hr_bits()` de la librería                                     |
| `parsear_hr_custom()`        | **Nueva** — parser single-pass con detección de laps inline y lógica frozen-fields          |
| `parsear_sesion_completa()`  | Reemplazado `sess.parse_samples() + filtrar_spikes_hr()` con `parsear_hr_custom()`          |

---

## Lección aprendida

> **La detección de laps y el decoding de HR deben compartir exactamente el mismo cursor y el mismo estado** (incluyendo frozen-fields). Cualquier pre-cálculo de posiciones en un paso separado introduce desfase por la lógica de frozen, que avanza 1 bit en lugar de 6 u 11.
