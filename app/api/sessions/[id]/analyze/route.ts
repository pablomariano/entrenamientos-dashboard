import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/sessions/auth-helper";
import { buildTrainingContext } from "@/lib/ai/context";
import { generateText } from "@/lib/ai/gemini";
import { GeminiSessionAnalysisSchema } from "@/lib/schemas";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { userId, error } = await getAuthenticatedUserId();
  if (error) return error;

  const { id } = await params;

  const session = await prisma.trainingSession.findFirst({
    where: { id, userId },
    include: {
      hrSamples: { orderBy: { timeOffsetSeconds: "asc" } },
      laps: { orderBy: { lapNumber: "asc" } },
      cardiacDrift: true,
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  const trainingContext = await buildTrainingContext(userId);

  const dateStr = format(session.date, "EEEE d 'de' MMMM yyyy", { locale: es });
  const durationMin = Math.round(session.duration / 60);

  const sessionDetails = [
    `Sesión: ${session.title}`,
    `Fecha: ${dateStr}`,
    `Deporte: ${session.sport}`,
    `Duración: ${durationMin} minutos`,
    session.hrAvg ? `FC Promedio: ${session.hrAvg} bpm` : null,
    session.hrMax ? `FC Máxima: ${session.hrMax} bpm` : null,
    session.hrMin ? `FC Mínima: ${session.hrMin} bpm` : null,
    session.trimp ? `TRIMP: ${session.trimp.toFixed(1)}` : null,
    session.laps.length > 0 ? `Laps: ${session.laps.length}` : null,
    session.cardiacDrift
      ? `Deriva cardíaca: ${session.cardiacDrift.driftPercent.toFixed(1)}% (FC ${session.cardiacDrift.hrStart} → ${session.cardiacDrift.hrEnd} bpm)`
      : null,
    session.notes ? `Notas del usuario: ${session.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Eres un entrenador personal experto en ciclismo y análisis de rendimiento físico.
Analiza la siguiente sesión de entrenamiento y proporciona un resumen conciso y recomendaciones prácticas en español.

${trainingContext}

=== SESIÓN A ANALIZAR ===
${sessionDetails}
=== FIN SESIÓN ===

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:
{
  "summary": "resumen de 2-3 párrafos sobre la sesión, rendimiento y cómo se compara con el historial",
  "recommendations": "1-3 recomendaciones concretas para la próxima sesión o recuperación"
}

No incluyas texto fuera del JSON. No uses markdown dentro del JSON.`;

  console.log("\n" + "=".repeat(60));
  console.log("PROMPT ENVIADO A GEMINI");
  console.log("=".repeat(60));
  console.log(prompt);
  console.log("=".repeat(60) + "\n");

  let rawResponse: string;
  try {
    rawResponse = await generateText(prompt);
  } catch (err) {
    console.error("AI provider error:", err);
    const errMsg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: `Error al conectar con el proveedor de IA: ${errMsg}` }, { status: 503 });
  }

  // Extraer JSON de la respuesta (puede venir con backticks o texto extra)
  const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ error: "Respuesta de Gemini no válida", raw: rawResponse }, { status: 502 });
  }

  let parsed: { summary: string; recommendations?: string };
  try {
    parsed = GeminiSessionAnalysisSchema.parse(JSON.parse(jsonMatch[0]));
  } catch {
    return NextResponse.json({ error: "Respuesta de Gemini con formato inesperado", raw: jsonMatch[0] }, { status: 502 });
  }

  const analysis = await prisma.aIAnalysis.create({
    data: {
      sessionId: id,
      summary: parsed.summary,
      recommendations: parsed.recommendations ?? null,
    },
  });

  return NextResponse.json(analysis);
}
