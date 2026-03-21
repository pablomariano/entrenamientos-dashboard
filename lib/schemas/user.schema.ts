import { z } from "zod";

// --- Actualizar perfil de usuario ---

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

// --- Respuesta de usuario ---

export const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  createdAt: z.string(),
});
export type UserResponse = z.infer<typeof UserResponseSchema>;
