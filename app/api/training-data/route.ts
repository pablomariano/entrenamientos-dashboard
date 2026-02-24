import { NextResponse } from "next/server";
import { z } from "zod";
import { readTrainingData, writeTrainingData } from "@/lib/entrenamientos/storage";

const HRSampleSchema = z.object({
  time_seconds: z.number(),
  hr: z.number(),
});

const LapSchema = z.object({
  lap_number: z.number(),
  time_seconds: z.number().optional(),
  duration_seconds: z.number().optional(),
  approximate_time_seconds: z.number().optional(),
});

const TrainingSessionSchema = z.object({
  id: z.string().optional(),
  start_time: z.string(),
  duration_seconds: z.number(),
  duration_formatted: z.string(),
  hr_avg: z.number().nullable().optional(),
  hr_max: z.number().nullable().optional(),
  hr_min: z.number().nullable().optional(),
  has_hr: z.boolean(),
  has_laps: z.boolean(),
  has_gps: z.boolean().optional(),
  num_laps: z.number().optional(),
  parseable: z.boolean(),
  hr_samples: z.array(HRSampleSchema).optional(),
  laps: z.array(LapSchema).optional(),
  distance: z.number().optional(),
});

const TrainingDataSchema = z.object({
  sessions: z.array(TrainingSessionSchema),
  total_sessions: z.number(),
  export_date: z.string(),
});

export async function GET() {
  try {
    const data = await readTrainingData();
    if (!data) {
      return NextResponse.json(
        { error: "No hay datos de entrenamientos" },
        { status: 404 }
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error reading training data:", error);
    return NextResponse.json(
      { error: "Error al leer los datos" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = TrainingDataSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await writeTrainingData(parsed.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving training data:", error);
    return NextResponse.json(
      { error: "Error al guardar los datos" },
      { status: 500 }
    );
  }
}
