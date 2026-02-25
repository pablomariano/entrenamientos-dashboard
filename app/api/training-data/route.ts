import { NextResponse } from "next/server";
import { z } from "zod";
import { readTrainingData, writeTrainingData } from "@/lib/entrenamientos/storage";

// Esquemas flexibles para aceptar variaciones en JSON (números como string, booleanos como 0/1)
const num = z.union([z.number(), z.string()]).transform((v) => (typeof v === "string" ? Number(v) : v));
const numOpt = z.union([z.number(), z.string(), z.null(), z.undefined()]).optional().transform((v) => (v == null || v === "" ? undefined : Number(v)));
const bool = z
  .union([z.boolean(), z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null || v === "" || v === "false" || v === "0" ? false : true));

const HRSampleSchema = z.object({
  time_seconds: num,
  hr: num,
});

const LapSchema = z.object({
  lap_number: num,
  time_seconds: numOpt,
  duration_seconds: numOpt,
  approximate_time_seconds: numOpt,
});

const TrainingSessionSchema = z.object({
  id: z.string().optional(),
  start_time: z.string(),
  duration_seconds: num,
  duration_formatted: z.string(),
  hr_avg: z.union([z.number(), z.string(), z.null()]).optional().transform((v) => (v == null ? undefined : Number(v))),
  hr_max: z.union([z.number(), z.string(), z.null()]).optional().transform((v) => (v == null ? undefined : Number(v))),
  hr_min: z.union([z.number(), z.string(), z.null()]).optional().transform((v) => (v == null ? undefined : Number(v))),
  has_hr: bool,
  has_laps: bool,
  has_gps: z.union([z.boolean(), z.number()]).optional().transform((v) => (v == null ? undefined : Boolean(v))),
  num_laps: numOpt,
  parseable: bool,
  hr_samples: z.array(HRSampleSchema).optional(),
  laps: z.array(LapSchema).optional(),
  distance: numOpt,
}).passthrough();

const TrainingDataSchema = z.object({
  sessions: z.array(TrainingSessionSchema),
  total_sessions: num,
  export_date: z.union([z.string(), z.number()]).transform((v) => String(v)),
}).passthrough();

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
      const first = parsed.error.errors[0];
      const hint = first ? ` (${first.path.join(".")}: ${first.message})` : "";
      return NextResponse.json(
        { error: `Datos inválidos${hint}`, details: parsed.error.flatten() },
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
