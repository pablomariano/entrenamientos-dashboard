import { z } from "zod";

// --- Respuesta del LLM parseada ---

export const AIAnalysisResponseSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  summary: z.string(),
  recommendations: z.string().nullable(),
  createdAt: z.string(),
});
export type AIAnalysisResponse = z.infer<typeof AIAnalysisResponseSchema>;

// --- Schema para validar la respuesta cruda de Gemini ---

export const GeminiSessionAnalysisSchema = z.object({
  summary: z.string().min(1),
  recommendations: z.string().optional(),
});
export type GeminiSessionAnalysis = z.infer<typeof GeminiSessionAnalysisSchema>;
