# 🐍 Scripts de Exportación y Diagnóstico

Esta carpeta contiene todos los scripts Python del proyecto.

## 📦 Scripts Principales

### 1. `exportar_para_dashboard.py`
**Propósito**: Exportar todas las sesiones en formato JSON estructurado para el dashboard.

**Uso**:
```bash
python scripts/exportar_para_dashboard.py
```

**Proceso**:
1. Conecta el dongle Polar DataLink
2. Selecciona "Connect > Start synchronizing" en tu reloj
3. Ejecuta el script
4. Los datos se guardan en `entrenamientos_dashboard/entrenamientos.json`

**Datos exportados**:
- Fecha y duración de cada sesión
- Estadísticas de HR (promedio, máximo, mínimo)
- Muestras detalladas de HR (para gráfico de evolución)

---

### 2. `abrir_dashboard.py`
**Propósito**: Iniciar servidor local para visualizar el dashboard.

**Uso**:
```bash
python scripts/abrir_dashboard.py
```

**Funcionalidad**:
- Inicia servidor HTTP en puerto 8000
- Abre automáticamente el dashboard en el navegador
- Evita problemas de CORS

---

## 🔧 Scripts de Diagnóstico

### 3. `diagnostico_sesiones.py`
**Propósito**: Analizar todas las sesiones y diagnosticar problemas de parsing.

**Uso**:
```bash
python scripts/diagnostico_sesiones.py
```

**Información mostrada**:
- Estructura de cada sesión
- Errores de parsing detallados
- Estado del cursor y bits
- Resumen de sesiones exitosas vs problemáticas

---

### 4. `diagnosticar_hr.py`
**Propósito**: Diagnosticar paso a paso cómo se parsean los valores de HR.

**Uso**:
```bash
python scripts/diagnosticar_hr.py
```

**Información mostrada**:
- Bits crudos de HR
- Tipo de valor (completo o delta)
- Cálculo de HR final
- Valores sospechosos (fuera de rango)

---

### 5. `encontrar_offset_hr.py`
**Propósito**: Encontrar el offset correcto para leer el HR inicial cuando hay GPS.

**Uso**:
```bash
python scripts/encontrar_offset_hr.py
```

**Funcionalidad**:
- Prueba offsets de 0 a 100
- Compara con el HR promedio del header
- Sugiere el offset correcto

---

### 6. `verificar_correccion.py`
**Propósito**: Verificar que las correcciones aplicadas funcionen correctamente.

**Uso**:
```bash
python scripts/verificar_correccion.py
```

**Verifica**:
- Valores de HR en rango válido (30-250 bpm)
- Promedios coinciden con el header
- No hay errores de parsing

---

### 7. `revisar_sesion_json.py`
**Propósito**: Analizar una sesión específica desde el archivo JSON exportado.

**Uso**:
```bash
python scripts/revisar_sesion_json.py
```

**Funcionalidad**:
- Lee desde `entrenamientos_dashboard/entrenamientos.json`
- Busca la sesión del 13/2/2026 (o modifica la fecha en el código)
- Muestra análisis detallado sin necesidad de sincronizar

---

### 8. `analizar_sesion.py`
**Propósito**: Analizar una sesión específica sincronizando con el reloj.

**Uso**:
```bash
python scripts/analizar_sesion.py
```

**Funcionalidad**:
- Sincroniza con el reloj
- Busca una sesión específica
- Analiza cómo se calcula la distancia y valida coordenadas GPS

---

## 🔄 Flujo de Trabajo Típico

### Primera vez:
1. `encontrar_offset_hr.py` - Encontrar offset correcto (si es necesario)
2. Aplicar patches a la librería instalada (ver `patches/README.md`)
3. `verificar_correccion.py` - Verificar que los patches funcionan
4. `exportar_para_dashboard.py` - Exportar datos
5. `abrir_dashboard.py` - Ver dashboard

### Uso regular:
1. `exportar_para_dashboard.py` - Exportar nuevos datos
2. `abrir_dashboard.py` - Ver dashboard actualizado

### Diagnóstico:
1. `diagnostico_sesiones.py` - Si hay problemas generales
2. `diagnosticar_hr.py` - Si hay problemas específicos con HR
3. `revisar_sesion_json.py` - Para revisar sesiones específicas

---

## 📋 Requisitos

Todos los scripts requieren:
- Python 3.7+
- `polar-rcx5-datalink` instalado: `pip install polar-rcx5-datalink`
- Patches aplicados (ver `patches/README.md`)
- Dongle Polar DataLink conectado (excepto `revisar_sesion_json.py`)

---

## 💡 Notas

- Los scripts asumen que están en la carpeta `scripts/` del proyecto
- Los datos se exportan a `entrenamientos_dashboard/` en el directorio actual
- Algunos scripts requieren sincronización con el reloj
- `revisar_sesion_json.py` es útil cuando no tienes el reloj a mano

---

**Última actualización**: Febrero 2026
