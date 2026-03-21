# Plan SDD — Entrenamientos Dashboard

Implementar la metodología Spec-Driven Development para evolucionar el dashboard de entrenamientos ciclistas hacia un sistema con modelo de datos relacional, autenticación, análisis de deriva cardíaca, asistente IA (Gemini), y calendario de planificación.

---

## Estado Actual

- **Stack**: Next.js 15, React 19, TypeScript, Tailwind v4, shadcn/ui, Prisma 7 + Neon PostgreSQL
- **Datos**: Se importan desde Polar RCX5 via scripts Python → JSON → dashboard
- **Prisma schema**: Modelo `Session` único y plano (sin relaciones)
- **Páginas**: Dashboard con gráficos funcionando, páginas de Calendario y Análisis vacías
- **Almacenamiento**: Dual (JSON local / Vercel Blob), sin usar la DB real aún

## Decisiones Técnicas

| Aspecto | Decisión |
|---|---|
| Base de datos | Neon PostgreSQL (ya configurado) |
| LLM | Google Gemini (API key del usuario) |
| Auth | NextAuth.js v5 (preparar single-user, extensible a multi-user) |
| Specs | Prisma schema (modelo) + Zod schemas (validación runtime) |
| MCP | Servidor MCP local que expone las funciones de análisis al agente IA |

---

## Fases SDD

### Fase 1 — Spec: Modelo de Datos y Contratos

Definir las especificaciones **antes** de escribir implementación.

**1.1 Prisma Schema** (`prisma/schema.prisma`)

Entidades y resoluciones:

- **User** — id, email, name, createdAt
  - `hrMax` y `hrRest` **se eliminan del perfil**. Se calculan automáticamente desde los datos de las sesiones:
    - `hrMax` = máximo HR registrado en todas las sesiones del usuario.
    - `hrRest` = mínimo HR registrado en sesiones (fallback: 60 bpm si no hay datos).
  - Esto evita pedir datos al usuario y se ajusta automáticamente con cada nueva sesión.

- **TrainingSession** — id, userId, title, date, duration, sport (enum: MTB, SPINNING), hrAvg, hrMax, hrMin, trimp, notes?, createdAt
  - Se elimina `type` (OUTDOOR/INDOOR) — el `sport` ya lo implica: MTB=outdoor, SPINNING=indoor.
  - Se elimina `distance` y todo lo GPS — el reloj no lo soporta.
  - Se elimina `rawData` — no se almacena permanentemente (ver flujo de sincronización abajo).
  - `title`: editable por el usuario, default auto-generado con formato descriptivo: `"Martes 22 de agosto por la mañana"`. Se genera a partir de la fecha/hora usando día de la semana + día + mes + franja horaria (mañana/tarde/noche).

- **DeletedSessionFingerprint** — id, userId, fingerprint, deletedAt
  - Almacena el fingerprint (hash de date+duration) de sesiones que el usuario eliminó, para que no se re-importen.

- **HRSample** — id, sessionId, timeOffsetSeconds, hr
  - `timeOffsetSeconds` (renombrado de `timeSeconds`): segundos desde el inicio de la sesión.

- **Lap** — id, sessionId, lapNumber, startOffsetSeconds, durationSeconds
  - `startOffsetSeconds` (renombrado de `timeSeconds`): segundo en que inicia el lap desde el comienzo de la sesión.
  - `durationSeconds`: duración del lap en segundos.
  - Ya no son ambiguos: uno es posición temporal, el otro es duración.

- **CardiacDrift** — id, sessionId, hrStart, hrEnd, driftPercent, steadyStateDurationSeconds, analysis

- **AIAnalysis** — id, sessionId, summary, recommendations, createdAt

- **ScheduledTraining** — id, userId, date, sport, durationPlanned, notes, completed, linkedSessionId?
  - Se elimina `type` — usa `sport` igual que TrainingSession.

Relaciones: User 1→N TrainingSession, TrainingSession 1→N HRSample, TrainingSession 1→N Lap, TrainingSession 1→1 CardiacDrift?, TrainingSession 1→N AIAnalysis, User 1→N ScheduledTraining, User 1→N DeletedSessionFingerprint.

#### Flujo de sincronización (importación sin rawData)

```
1. Usuario ejecuta script Python → genera entrenamientos.json
2. Usuario sube JSON al sistema (via UI o API)
3. Para cada sesión en el JSON:
   a. Calcular fingerprint = hash(date + duration)
   b. ¿Existe en DeletedSessionFingerprint? → SKIP (usuario la eliminó)
   c. ¿Existe en TrainingSession con misma date? → SKIP (ya importada)
   d. Si no existe → INSERT nueva sesión con samples y laps
4. Las sesiones existentes NO se sobreescriben
5. Cuando el usuario elimina una sesión:
   a. Se guarda el fingerprint en DeletedSessionFingerprint
   b. Se elimina la sesión y sus datos relacionados (cascade)
```

Esto permite re-importar el JSON completo sin duplicar ni resucitar sesiones eliminadas.

#### Contexto IA para evaluar evolución

El servidor MCP tendrá un tool `get_training_context` que consulta la DB y construye un resumen estructurado:

```
- Últimas 20 sesiones: fecha, sport, duración, hrAvg, hrMax, TRIMP
- Tendencias: TRIMP semanal (últimas 4 semanas), volumen (horas/semana)
- Deriva cardíaca: evolución de driftPercent en sesiones de spinning
- Entrenamientos programados vs completados
- HR calculados: hrMax y hrRest derivados de las sesiones del usuario
```

Este resumen se inyecta como contexto en cada prompt a Gemini, permitiéndole evaluar progresión, detectar sobreentrenamiento y sugerir recuperación.

#### DBML — Diagrama del modelo de datos

```dbml
Enum Sport {
  MTB
  SPINNING
}

Table User {
  id String [pk]
  email String [unique, not null]
  name String
  createdAt DateTime [default: `now()`]
  Note: 'hrMax y hrRest se calculan dinámicamente desde TrainingSession'
}

Table TrainingSession {
  id String [pk]
  userId String [not null, ref: > User.id]
  title String [not null]
  date DateTime [not null]
  duration Int [not null, note: 'segundos']
  sport Sport [not null]
  hrAvg Int
  hrMax Int
  hrMin Int
  trimp Float
  notes String
  createdAt DateTime [default: `now()`]
  updatedAt DateTime

  indexes {
    (userId, date) [unique]
    date
  }
}

Table DeletedSessionFingerprint {
  id String [pk]
  userId String [not null, ref: > User.id]
  fingerprint String [not null]
  deletedAt DateTime [default: `now()`]

  indexes {
    (userId, fingerprint) [unique]
  }
}

Table HRSample {
  id String [pk]
  sessionId String [not null, ref: > TrainingSession.id]
  timeOffsetSeconds Int [not null, note: 'segundos desde inicio de sesión']
  hr Int [not null]

  indexes {
    sessionId
  }
}

Table Lap {
  id String [pk]
  sessionId String [not null, ref: > TrainingSession.id]
  lapNumber Int [not null]
  startOffsetSeconds Int [not null, note: 'segundo de inicio desde comienzo de sesión']
  durationSeconds Int [not null, note: 'duración del lap']

  indexes {
    sessionId
  }
}

Table CardiacDrift {
  id String [pk]
  sessionId String [unique, not null, ref: - TrainingSession.id]
  hrStart Int [not null, note: 'HR promedio primera mitad']
  hrEnd Int [not null, note: 'HR promedio segunda mitad']
  driftPercent Float [not null]
  steadyStateDurationSeconds Int [not null]
  analysis String
}

Table AIAnalysis {
  id String [pk]
  sessionId String [not null, ref: > TrainingSession.id]
  summary String [not null]
  recommendations String
  createdAt DateTime [default: `now()`]
}

Table ScheduledTraining {
  id String [pk]
  userId String [not null, ref: > User.id]
  date DateTime [not null]
  sport Sport [not null]
  durationPlanned Int [note: 'minutos']
  notes String
  completed Boolean [default: false]
  linkedSessionId String [ref: - TrainingSession.id]
  createdAt DateTime [default: `now()`]
}
```

Puedes pegar este DBML en [dbdiagram.io](https://dbdiagram.io) para visualizar el diagrama ER interactivo.

**1.2 Zod Schemas** (`lib/schemas/`)

- `session.schema.ts` — validación de input al crear/importar sesión
- `scheduled-training.schema.ts` — validación de entrenamientos programados
- `user-settings.schema.ts` — validación de configuración del usuario (nombre, email)
- `ai-analysis.schema.ts` — validación de respuesta del LLM

**1.3 API Contracts** (`docs/api-spec.md`)

Documentar endpoints REST con input/output esperado:
- `POST /api/sessions/import` — importar sesión desde JSON
- `GET /api/sessions` — listar sesiones con filtros
- `GET /api/sessions/[id]` — detalle con samples, laps, drift, análisis IA
- `POST /api/sessions/[id]/analyze` — solicitar análisis IA
- `CRUD /api/schedule` — gestionar entrenamientos programados
- `GET /api/stats/evolution` — datos de evolución para el dashboard
- `POST /api/ai/suggest-plan` — pedir sugerencia de plan a la IA

---

### Fase 2 — Stub: Esqueletos e Infraestructura

Implementar la estructura sin lógica de negocio real.

- **2.1** Ejecutar migración Prisma con el nuevo schema contra Neon
- **2.2** Generar Zod schemas con tipos exportados
- **2.3** Crear stubs de API routes (retornan 501 Not Implemented)
- **2.4** Configurar NextAuth v5 con provider credentials (email/password) para single-user
- **2.5** Crear estructura de carpetas para el servidor MCP

---

### Fase 3 — Implementación Core

Llenar la lógica real, fase por fase.

**3.1 Migración de datos: JSON → DB**
- Script que lee `entrenamientos.json` y puebla la DB via Prisma
- Migrar `data-processor.ts` para leer de DB en vez de JSON
- Refactorear `training-data-context.tsx` para usar API → DB

**3.2 Importación de sesiones**
- Endpoint `POST /api/sessions/import` que recibe JSON del script Python
- Validación con Zod, persistencia con Prisma
- Clasificación automática: Detectar sesiones de spinning con esfuerzo sostenido (>20min en misma zona HR)

**3.3 Deriva Cardíaca**
- Para las sesiones sesiones de spinning con esfuerzo sostenido (>30min en misma zona HR)
- Calcular drift: comparar HR promedio primera mitad vs segunda mitad a mismo esfuerzo
- Almacenar en tabla `CardiacDrift`
- Visualizar evolución del drift en el tiempo

**3.4 Asistente IA (Gemini + MCP)**
- Servidor MCP que expone tools: `analyze_session`, `suggest_recovery`, `evaluate_progress`, `suggest_training_plan`
- Integración con Google Gemini API para generar interpretaciones
- Después de cada importación, disparar análisis automático
- Almacenar respuestas en `AIAnalysis`
- Componente de chat/resumen en el detalle de cada sesión

**3.5 Calendario/Agenda**
- Página `/dashboard/calendario` con vista mensual (react-day-picker ya instalado)
- CRUD de entrenamientos programados (`ScheduledTraining`)
- Vincular sesión real con entrenamiento programado cuando se importa
- La IA puede sugerir un plan semanal basado en historial y progreso

**3.6 Autenticación**
- NextAuth v5 con Prisma adapter
- Login page, protección de rutas
- Seed de usuario inicial (tú)

---

### Fase 4 — Validación e Integridad

- **4.1** Validar que todos los endpoints cumplen los Zod schemas
- **4.2** Tests de integración: importar sesión → almacenar → analizar → mostrar
- **4.3** Verificar que el dashboard existente funciona idéntico con datos desde DB
- **4.4** Revisar seguridad: auth en todos los endpoints, sanitización de inputs
- **4.5** Documentar el flujo completo en README actualizado

---

## Orden de Implementación Sugerido

| Paso | Fase | Prioridad |
|---|---|---|
| 1 | Prisma schema + migración | Alta |
| 2 | Zod schemas | Alta |
| 3 | Auth básica (NextAuth) | Alta |
| 4 | API stubs | Alta |
| 5 | Migración JSON → DB | Alta |
| 6 | Refactor dashboard → DB | Alta |
| 7 | Importación de sesiones | Alta |
| 8 | Deriva cardíaca | Media |
| 9 | Calendario/agenda | Media |
| 10 | Integración Gemini + MCP | Media |
| 11 | Sugerencias IA de plan | Baja |
| 12 | Validación y tests | Alta |

---

## Archivos Clave a Crear/Modificar

**Crear:**
- `lib/schemas/*.ts` — Zod schemas
- `app/api/sessions/...` — API routes
- `app/api/schedule/...` — API routes calendario
- `app/api/ai/...` — API routes IA
- `lib/ai/gemini.ts` — Cliente Gemini
- `lib/ai/mcp-server.ts` — Servidor MCP
- `lib/auth/...` — Configuración NextAuth
- `docs/api-spec.md` — Contratos API

**Modificar:**
- `prisma/schema.prisma` — Expandir modelo
- `lib/entrenamientos/data-processor.ts` — Leer de DB
- `lib/entrenamientos/training-data-context.tsx` — Usar nueva API
- `app/dashboard/calendario/page.tsx` — Implementar
- `app/dashboard/analisis/page.tsx` — Implementar
- `scripts/exportar_para_dashboard.py` — Exportar directo a API
