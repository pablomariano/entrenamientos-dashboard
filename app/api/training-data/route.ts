import { NextResponse } from "next/server";
import { z } from "zod";
import { readTrainingData, writeTrainingData } from "@/lib/entrenamientos/storage";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

/** Convierte valores a Float | null para Prisma (evita objetos o strings no numéricos). */
function toFloatOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/** Convierte valores a Int | null para Prisma. */
function toIntOrNull(v: unknown): number | null {
  const f = toFloatOrNull(v);
  return f == null ? null : Math.round(f);
}

export async function GET() {
  try {
    // Primero intentamos leer de la base de datos
    const dbSessions = await prisma.session.findMany({
      orderBy: { date: 'desc' }
    });

    if (dbSessions.length > 0) {
      // Si hay datos en la BD, los devolvemos en el formato que espera el frontend
      const formatDuration = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return [h, m, s].map((n) => n.toString().padStart(2, "0")).join(":");
      };
      return NextResponse.json({
        sessions: dbSessions.map((s: any) => {
          const raw = (s.rawData as any) || {};
          return {
            ...raw,
            id: s.id,
            start_time: s.date.toISOString(),
            duration_seconds: s.duration,
            duration_formatted: raw.duration_formatted ?? formatDuration(s.duration),
            sport: s.sport,
            distance: s.distance,
            hr_avg: s.avgHr,
            hr_max: s.maxHr,
            calories: s.calories,
            trimp: s.trimp,
            laps: s.laps,
            has_hr: raw.has_hr ?? (s.avgHr != null),
            has_laps: raw.has_laps ?? (s.laps != null && Array.isArray(s.laps) && s.laps.length > 0),
            parseable: raw.parseable ?? true,
            num_laps: raw.num_laps ?? (Array.isArray(s.laps) ? s.laps.length : undefined),
          };
        }),
        total_sessions: dbSessions.length,
        export_date: new Date().toISOString(),
        source: 'database'
      });
    }

    // Fallback a archivos locales si no hay nada en la BD
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

    // 1. Guardar en archivos locales (mantener compatibilidad por ahora)
    await writeTrainingData(parsed.data);

    // 2. Guardar cada sesión en la base de datos de Neon
    const upsertPromises = parsed.data.sessions.map((session) => {
      const sessionDate = new Date(session.start_time);
      
      return prisma.session.upsert({
        where: {
          id: session.id || `session-${sessionDate.getTime()}`, 
        },
        update: {
          date: sessionDate,
          duration: session.duration_seconds,
          sport: (session as any).sport || "Unknown",
          distance: toFloatOrNull((session as any).distance) ?? undefined,
          avgHr: toIntOrNull(session.hr_avg) ?? undefined,
          maxHr: toIntOrNull(session.hr_max) ?? undefined,
          calories: toIntOrNull((session as any).calories) ?? undefined,
          trimp: toFloatOrNull((session as any).trimp) ?? undefined,
          laps: session.laps as any,
          rawData: session as any,
          updatedAt: new Date(),
        },
        create: {
          id: session.id || `session-${sessionDate.getTime()}`,
          date: sessionDate,
          duration: session.duration_seconds,
          sport: (session as any).sport || "Unknown",
          distance: toFloatOrNull((session as any).distance) ?? undefined,
          avgHr: toIntOrNull(session.hr_avg) ?? undefined,
          maxHr: toIntOrNull(session.hr_max) ?? undefined,
          calories: toIntOrNull((session as any).calories) ?? undefined,
          trimp: toFloatOrNull((session as any).trimp) ?? undefined,
          laps: session.laps as any,
          rawData: session as any,
        },
      });
    });

    await Promise.all(upsertPromises);

    return NextResponse.json({ 
      success: true, 
      count: parsed.data.sessions.length,
      message: "Datos guardados en archivos y base de datos" 
    });
  } catch (error) {
    console.error("Error saving training data:", error);
    return NextResponse.json(
      { error: "Error al guardar los datos en la base de datos" },
      { status: 500 }
    );
  }
}
