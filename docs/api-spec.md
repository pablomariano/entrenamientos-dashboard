# API Spec — Entrenamientos Dashboard

Contratos de los endpoints REST del sistema. Todos los endpoints requieren autenticación (NextAuth session) excepto donde se indique.

---

## Sesiones

### `POST /api/sessions/import`

Importa sesiones desde el JSON generado por el script Python. Usa el flujo de sincronización con fingerprints para evitar duplicados y respetar eliminaciones.

**Request Body**: `ImportPayloadSchema` (ver `lib/schemas/session.schema.ts`)

```json
{
  "sessions": [
    {
      "start_time": "2026-03-21T07:30:00-03:00",
      "duration_seconds": 3600,
      "hr_avg": 145,
      "hr_max": 178,
      "hr_min": 85,
      "has_hr": true,
      "has_laps": true,
      "num_laps": 3,
      "parseable": true,
      "hr_samples": [{ "time_seconds": 0, "hr": 85 }, { "time_seconds": 5, "hr": 90 }],
      "laps": [{ "lap_number": 1, "time_seconds": 0, "duration_seconds": 1200 }]
    }
  ],
  "total_sessions": 1,
  "export_date": "2026-03-21"
}
```

**Response 200**:
```json
{
  "imported": 3,
  "skipped": 2,
  "skippedDeleted": 1,
  "total": 6
}
```

---

### `GET /api/sessions`

Lista sesiones del usuario autenticado, ordenadas por fecha descendente.

**Query params** (opcionales):
- `sport` — filtrar por `MTB` | `SPINNING`
- `from` — fecha inicio (ISO 8601)
- `to` — fecha fin (ISO 8601)
- `limit` — número máximo de resultados (default: 50)
- `offset` — paginación

**Response 200**: `SessionResponse[]`

---

### `GET /api/sessions/[id]`

Detalle completo de una sesión, incluyendo HR samples, laps, cardiac drift y análisis IA.

**Response 200**:
```json
{
  "id": "clx...",
  "title": "Viernes 21 de marzo por la mañana",
  "date": "2026-03-21T07:30:00.000Z",
  "duration": 3600,
  "sport": "SPINNING",
  "hrAvg": 145,
  "hrMax": 178,
  "hrMin": 85,
  "trimp": 95.3,
  "notes": null,
  "hrSamples": [{ "timeOffsetSeconds": 0, "hr": 85 }],
  "laps": [{ "lapNumber": 1, "startOffsetSeconds": 0, "durationSeconds": 1200 }],
  "cardiacDrift": {
    "hrStart": 140,
    "hrEnd": 155,
    "driftPercent": 10.7,
    "steadyStateDurationSeconds": 1800,
    "analysis": "Drift moderado..."
  },
  "aiAnalyses": [{ "id": "clx...", "summary": "...", "recommendations": "...", "createdAt": "..." }]
}
```

---

### `PATCH /api/sessions/[id]`

Actualiza título, notas o sport de una sesión.

**Request Body**: `UpdateSessionSchema`

```json
{
  "title": "Spinning matutino intenso",
  "notes": "Me sentí con mucha energía"
}
```

**Response 200**: `SessionResponse`

---

### `DELETE /api/sessions/[id]`

Elimina una sesión y registra su fingerprint en `DeletedSessionFingerprint` para evitar re-importación.

**Response 200**:
```json
{ "deleted": true }
```

---

## Análisis IA

### `POST /api/sessions/[id]/analyze`

Solicita un análisis IA de la sesión usando Gemini. El sistema construye el contexto de entrenamiento (últimas 20 sesiones, tendencias, etc.) y lo envía junto con los datos de la sesión.

**Response 200**: `AIAnalysisResponse`

---

### `POST /api/ai/suggest-plan`

Solicita a la IA una sugerencia de plan de entrenamiento semanal basado en el historial y progreso.

**Request Body** (opcional):
```json
{
  "weekStartDate": "2026-03-24",
  "preferences": "Quiero entrenar 4 días esta semana"
}
```

**Response 200**:
```json
{
  "suggestions": [
    { "date": "2026-03-24", "sport": "SPINNING", "durationPlanned": 45, "notes": "Sesión de recuperación..." },
    { "date": "2026-03-26", "sport": "MTB", "durationPlanned": 90, "notes": "Ruta de montaña..." }
  ],
  "rationale": "Basado en tu carga de entrenamiento..."
}
```

---

## Calendario / Entrenamientos Programados

### `GET /api/schedule`

Lista entrenamientos programados del usuario.

**Query params** (opcionales):
- `from` — fecha inicio
- `to` — fecha fin
- `completed` — `true` | `false`

**Response 200**: `ScheduledTrainingResponse[]`

---

### `POST /api/schedule`

Crea un entrenamiento programado.

**Request Body**: `CreateScheduledTrainingSchema`

**Response 201**: `ScheduledTrainingResponse`

---

### `PATCH /api/schedule/[id]`

Actualiza un entrenamiento programado.

**Request Body**: `UpdateScheduledTrainingSchema`

**Response 200**: `ScheduledTrainingResponse`

---

### `DELETE /api/schedule/[id]`

Elimina un entrenamiento programado.

**Response 200**: `{ "deleted": true }`

---

## Estadísticas

### `GET /api/stats/evolution`

Datos de evolución para el dashboard: TRIMP por semana, volumen, HR trends, drift evolution.

**Query params** (opcionales):
- `weeks` — número de semanas hacia atrás (default: 12)

**Response 200**:
```json
{
  "weekly": [
    {
      "weekStart": "2026-03-17",
      "sessions": 3,
      "totalDuration": 7200,
      "avgTrimp": 85.2,
      "avgHr": 142,
      "maxHr": 178
    }
  ],
  "cardiacDriftTrend": [
    { "date": "2026-03-10", "driftPercent": 12.5 },
    { "date": "2026-03-17", "driftPercent": 10.2 }
  ],
  "hrCalculated": {
    "hrMax": 185,
    "hrRest": 62
  }
}
```
