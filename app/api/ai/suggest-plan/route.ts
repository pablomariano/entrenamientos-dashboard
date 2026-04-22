import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/sessions/auth-helper";
import { buildTrainingContext } from "@/lib/ai/context";
import { generateText } from "@/lib/ai/gemini";
import { z } from "zod";

const RequestSchema = z.object({
  weekStartDate: z.string().optional(),
  preferences: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const { userId, error } = await getAuthenticatedUserId();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { weekStartDate, preferences } = parsed.data;

  const trainingContext = await buildTrainingContext(userId);

  const prompt = `Eres un entrenador personal experto en ciclismo. Basándote en el historial de entrenamiento del atleta, sugiere un plan de entrenamiento para la próxima semana.

${trainingContext}

${weekStartDate ? `La semana comienza el: ${weekStartDate}` : ""}
${preferences ? `Preferencias del atleta: ${preferences}` : ""}

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:
{
  "rationale": "explicación de 1-2 párrafos del razonamiento del plan basado en el historial",
  "suggestions": [
    {
      "date": "YYYY-MM-DD",
      "sport": "MTB o SPINNING",
      "durationPlanned": 45,
      "notes": "descripción breve del objetivo de la sesión"
    }
  ]
}

Reglas:
- Sugiere entre 2 y 5 sesiones para la semana
- sport debe ser exactamente "MTB" o "SPINNING"
- durationPlanned en minutos (entero)
- Considera la carga acumulada (TRIMP) para evitar sobreentrenamiento
- Si hay sesiones de alta carga reciente, incluye días de recuperación activa
- No incluyas texto fuera del JSON. No uses markdown dentro del JSON.`;

  let rawResponse: string;
  try {
    rawResponse = await generateText(prompt);
  } catch (err) {
    console.error("AI error:", err);
    return NextResponse.json({ error: "Error al conectar con la IA. Verifica DEEPSEEK_API_KEY." }, { status: 503 });
  }

  const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "Respuesta de IA no válida", raw: rawResponse }, { status: 502 });
  }

  try {
    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Respuesta de IA con formato inesperado", raw: jsonMatch[0] }, { status: 502 });
  }
}
