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

// Coerciones flexibles para datos del Polar RCX5 (pueden llegar como string, number o boolean)
const flexBool = z
  .union([z.boolean(), z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => v != null && v !== "" && v !== "false" && v !== "0" && v !== 0);

const toNum = (v: unknown) => (v == null || v === "" ? undefined : Number(v));
const toInt = (v: unknown) => {
  if (v == null || v === "") return undefined;
  const n = Math.round(Number(v));
  return Number.isNaN(n) ? undefined : n;
};

const flexNum = z.union([z.number(), z.string(), z.null(), z.undefined()]).optional().transform(toNum);
const flexInt = z.union([z.number(), z.string(), z.null(), z.undefined()]).optional().transform(toInt);

// --- Sesión individual dentro del JSON de importación ---

export const ImportSessionSchema = z.object({
  start_time: z.string(),
  start_utctime: z.string().optional(),
  duration_seconds: z.union([z.number(), z.string()]).transform((v) => Math.round(Number(v))),
  duration_formatted: z.string().optional(),
  hr_avg: flexInt,
  hr_max: flexInt,
  hr_min: flexInt,
  has_hr: flexBool,
  has_laps: flexBool,
  has_gps: flexBool.optional(),
  num_laps: flexInt,
  parseable: z
    .union([z.boolean(), z.number(), z.string(), z.null(), z.undefined()])
    .optional()
    .transform((v) => v == null ? true : v !== "" && v !== "false" && v !== "0" && v !== 0 && !!v),
  hr_samples: z.array(z.object({
    time_seconds: z.union([z.number(), z.string()]).transform(Number),
    hr: z.union([z.number(), z.string()]).transform(Number),
  })).optional(),
  laps: z.array(z.object({
    lap_number: z.union([z.number(), z.string()]).transform(Number),
    time_seconds: flexNum,
    duration_seconds: flexNum,
    approximate_time_seconds: flexNum,
  })).optional(),
}).passthrough();
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
