import { NextRequest, NextResponse } from "next/server"; // NEXT.js
import { auth } from "@/lib/auth"; // auth.ts en @/lib/
import prisma from "@/lib/prisma"; // prisma.ts en @/lib/
import { ImportPayloadSchema } from "@/lib/schemas"; // ImportPayloadSchema.ts en @/lib/schemas
import { computeFingerprint } from "@/lib/sessions/fingerprint"; // computeFingerprint.ts en @/lib/sessions
import { generateSessionTitle } from "@/lib/sessions/title"; // generateSessionTitle.ts en @/lib/sessions
import { calculateTRIMP, calcUserHR } from "@/lib/sessions/trimp"; // trimp.ts en @/lib/sessions
import { calculateCardiacDrift } from "@/lib/sessions/cardiac-drift"; // cardiac-drift.ts en @/lib/sessions
import type { Sport } from "@prisma/client"; // Sport.ts en @/lib/schemas

export const dynamic = "force-dynamic"; // Fuerza a Next.js a generar la página dinámicamente

// Formatear duración de segundos a horas, minutos y segundos
function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600); // Horas
  const m = Math.floor((sec % 3600) / 60); // Minutos
  const s = sec % 60; // Segundos
  return [h, m, s].map((n) => n.toString().padStart(2, "0")).join(":");
}

// Maneja las peticiones GET a /api/training-data para obtener todas las sesiones del usuario
export async function GET() {
  const session = await auth(); // Obtiene la sesión del usuario
  const userId = session?.user?.id; // Obtiene el ID del usuario

  try {
    if (userId) { // Si el usuario está autenticado
      const dbSessions = await prisma.trainingSession.findMany({ // Busca todas las sesiones del usuario
        where: { userId }, // Filtra por el usuario actual
        orderBy: { date: "desc" }, // Ordena por fecha descendente
        include: {
          hrSamples: { orderBy: { timeOffsetSeconds: "asc" } }, // Incluye las muestras de frecuencia cardíaca ordenadas por tiempo
          laps: { orderBy: { lapNumber: "asc" } }, // Incluye las vueltas ordenadas por número de vuelta
        },
      });

      if (dbSessions.length > 0) {
        return NextResponse.json({
          sessions: dbSessions.map((s) => ({
            id: s.id,
            start_time: s.date.toISOString(),
            duration_seconds: s.duration,
            duration_formatted: formatDuration(s.duration),
            sport: s.sport,
            hr_avg: s.hrAvg ?? undefined,
            hr_max: s.hrMax ?? undefined,
            hr_min: s.hrMin ?? undefined,
            has_hr: s.hrAvg != null,
            has_laps: s.laps.length > 0,
            has_gps: false,
            num_laps: s.laps.length,
            parseable: true,
            trimp: s.trimp ?? undefined,
            notes: s.notes ?? undefined,
            title: s.title,
            hr_samples: s.hrSamples.map((h) => ({
              time_seconds: h.timeOffsetSeconds,
              hr: h.hr,
            })),
            laps: s.laps.map((l) => ({
              lap_number: l.lapNumber,
              time_seconds: l.startOffsetSeconds,
              duration_seconds: l.durationSeconds,
            })),
          })),
          total_sessions: dbSessions.length,
          export_date: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({ error: "No hay datos de entrenamientos" }, { status: 404 });
  } catch (error) {
    console.error("Error reading training data:", error);
    return NextResponse.json({ error: "Error al leer los datos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = ImportPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const { sessions } = parsed.data;

    const deletedFingerprints = await prisma.deletedSessionFingerprint.findMany({
      where: { userId },
      select: { fingerprint: true },
    });
    const deletedSet = new Set(deletedFingerprints.map((d) => d.fingerprint));

    const existingSessions = await prisma.trainingSession.findMany({
      where: { userId },
      select: { date: true, duration: true, hrMin: true, hrMax: true, hrAvg: true },
    });
    const existingFingerprints = new Set(
      existingSessions.map((s) => computeFingerprint(s.date, s.duration))
    );
    const { hrRest, hrMax: userHrMax } = calcUserHR(existingSessions);

    let imported = 0;
    let skipped = 0;

    for (const raw of sessions) {
      if (!raw.parseable) { skipped++; continue; }

      const hasTimezone = raw.start_time.includes("Z") || /[+-]\d{2}:?\d{2}$/.test(raw.start_time);
      const date = new Date(hasTimezone ? raw.start_time : `${raw.start_time}Z`);
      const fingerprint = computeFingerprint(date, raw.duration_seconds);

      const rawHrAvg = raw.hr_avg ?? null;
      const rawHrMax = raw.hr_max ?? null;

      // Robust duplicate check: exact fingerprint OR same duration & date within 25 hours (covers timezone offsets) & same HR
      const isDuplicate = deletedSet.has(fingerprint) || existingFingerprints.has(fingerprint) || existingSessions.some((s) => {
        if (s.duration !== raw.duration_seconds) return false;
        const timeDiffMs = Math.abs(s.date.getTime() - date.getTime());
        const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
        if (timeDiffHours >= 25) return false;
        if (s.hrAvg != null && rawHrAvg != null && s.hrAvg !== rawHrAvg) return false;
        if (s.hrMax != null && rawHrMax != null && s.hrMax !== rawHrMax) return false;
        return true;
      });

      if (isDuplicate) {
        skipped++;
        continue;
      }

      const sport: Sport = detectSport(raw.hr_samples ?? [], raw.duration_seconds);
      const hrAvg = raw.hr_avg ?? null;
      const hrMax = raw.hr_max ?? null;
      const hrMin = raw.hr_min ?? null;
      const trimp = hrAvg && hrMax
        ? calculateTRIMP(raw.duration_seconds, hrAvg, hrMax, hrRest, userHrMax)
        : null;

      const hrSamplesForDrift = (raw.hr_samples ?? [])
        .filter((s) => s.hr >= 40 && s.hr <= 250)
        .map((s) => ({ timeOffsetSeconds: Math.round(s.time_seconds), hr: s.hr }));
      const drift = sport === "SPINNING"
        ? calculateCardiacDrift(hrSamplesForDrift, raw.duration_seconds)
        : null;

      await prisma.trainingSession.create({
        data: {
          userId,
          title: generateSessionTitle(date),
          date,
          duration: raw.duration_seconds,
          sport,
          hrAvg,
          hrMax,
          hrMin,
          trimp,
          hrSamples: raw.hr_samples ? {
            create: raw.hr_samples
              .filter((s) => s.hr >= 30 && s.hr <= 250)
              .map((s) => ({ timeOffsetSeconds: Math.round(s.time_seconds), hr: s.hr })),
          } : undefined,
          laps: raw.laps ? {
            create: raw.laps
              .filter((l) => l.lap_number != null)
              .map((l) => ({
                lapNumber: l.lap_number,
                startOffsetSeconds: Math.round(l.time_seconds ?? l.approximate_time_seconds ?? 0),
                durationSeconds: Math.round(l.duration_seconds ?? 0),
              })),
          } : undefined,
          cardiacDrift: drift ? { create: { ...drift } } : undefined,
        },
      });

      imported++;
    }

    return NextResponse.json({ success: true, imported, skipped, total: sessions.length });
  } catch (error) {
    console.error("Error importing training data:", error);
    return NextResponse.json({ error: "Error al importar los datos" }, { status: 500 });
  }
}

function detectSport(
  hrSamples: Array<{ time_seconds: number; hr: number }>,
  durationSeconds: number
): Sport {
  const valid = hrSamples.filter((s) => s.hr >= 30 && s.hr <= 250);
  if (valid.length < 20 || durationSeconds < 1200) return "MTB";
  const hrs = valid.map((s) => s.hr);
  const mean = hrs.reduce((a, b) => a + b, 0) / hrs.length;
  const variance = hrs.reduce((acc, v) => acc + (v - mean) ** 2, 0) / hrs.length;
  return Math.sqrt(variance) / mean < 0.08 ? "SPINNING" : "MTB";
}
