import { z } from "zod";
import { SportEnum } from "./session.schema";

// --- Crear entrenamiento programado ---

export const CreateScheduledTrainingSchema = z.object({
  date: z.string().datetime({ offset: true }),
  sport: SportEnum,
  durationPlanned: z.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateScheduledTrainingInput = z.infer<typeof CreateScheduledTrainingSchema>;

// --- Actualizar entrenamiento programado ---

export const UpdateScheduledTrainingSchema = z.object({
  date: z.string().datetime({ offset: true }).optional(),
  sport: SportEnum.optional(),
  durationPlanned: z.number().int().positive().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  completed: z.boolean().optional(),
  linkedSessionId: z.string().nullable().optional(),
});
export type UpdateScheduledTrainingInput = z.infer<typeof UpdateScheduledTrainingSchema>;

// --- Respuesta de entrenamiento programado ---

export const ScheduledTrainingResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  date: z.string(),
  sport: SportEnum,
  durationPlanned: z.number().int().nullable(),
  notes: z.string().nullable(),
  completed: z.boolean(),
  linkedSessionId: z.string().nullable(),
  createdAt: z.string(),
});
export type ScheduledTrainingResponse = z.infer<typeof ScheduledTrainingResponseSchema>;
