import { z } from "zod";

export const SportEnum = z.enum(["MTB", "SPINNING"]);
export type Sport = z.infer<typeof SportEnum>;

// --- HR Sample ---

export const HRSampleSchema = z.object({
  timeOffsetSeconds: z.number().int().nonnegative(),
  hr: z.number().int().min(30).max(250),
});
export type HRSampleInput = z.infer<typeof HRSampleSchema>;

// --- Lap ---

export const LapSchema = z.object({
  lapNumber: z.number().int().positive(),
  startOffsetSeconds: z.number().int().nonnegative(),
  durationSeconds: z.number().int().positive(),
});
export type LapInput = z.infer<typeof LapSchema>;

// --- Sesión individual dentro del JSON de importación ---

export const ImportSessionSchema = z.object({
  start_time: z.string().datetime({ offset: true }),
  duration_seconds: z.number().int().positive(),
  duration_formatted: z.string().optional(),
  hr_avg: z.number().int().min(30).max(250).nullable().optional(),
  hr_max: z.number().int().min(30).max(250).nullable().optional(),
  hr_min: z.number().int().min(30).max(250).nullable().optional(),
  has_hr: z.boolean(),
  has_laps: z.boolean(),
  num_laps: z.number().int().nonnegative().optional(),
  parseable: z.boolean(),
  hr_samples: z.array(z.object({
    time_seconds: z.number(),
    hr: z.number(),
  })).optional(),
  laps: z.array(z.object({
    lap_number: z.number().int(),
    time_seconds: z.number().optional(),
    duration_seconds: z.number().optional(),
    approximate_time_seconds: z.number().optional(),
  })).optional(),
});
export type ImportSessionInput = z.infer<typeof ImportSessionSchema>;

// --- Payload completo de importación (entrenamientos.json) ---

export const ImportPayloadSchema = z.object({
  sessions: z.array(ImportSessionSchema),
  total_sessions: z.number().int().nonnegative(),
  export_date: z.string(),
});
export type ImportPayloadInput = z.infer<typeof ImportPayloadSchema>;

// --- Actualización de sesión (título, notas, sport) ---

export const UpdateSessionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).optional(),
  sport: SportEnum.optional(),
});
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>;

// --- Respuesta de sesión (output de la API) ---

export const SessionResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  date: z.string(),
  duration: z.number().int(),
  sport: SportEnum,
  hrAvg: z.number().int().nullable(),
  hrMax: z.number().int().nullable(),
  hrMin: z.number().int().nullable(),
  trimp: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
