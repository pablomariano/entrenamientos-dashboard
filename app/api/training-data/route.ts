import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ImportPayloadSchema } from "@/lib/schemas";
import { computeFingerprint } from "@/lib/sessions/fingerprint";
import { generateSessionTitle } from "@/lib/sessions/title";
import { calculateTRIMP, calcUserHR } from "@/lib/sessions/trimp";
import type { Sport } from "@prisma/client";

export const dynamic = "force-dynamic";

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((n) => n.toString().padStart(2, "0")).join(":");
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  try {
    if (userId) {
      const dbSessions = await prisma.trainingSession.findMany({
        where: { userId },
        orderBy: { date: "desc" },
        include: {
          hrSamples: { orderBy: { timeOffsetSeconds: "asc" } },
          laps: { orderBy: { lapNumber: "asc" } },
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
      select: { date: true, hrMin: true, hrMax: true },
    });
    const existingDates = new Set(existingSessions.map((s) => s.date.toISOString()));
    const { hrRest, hrMax: userHrMax } = calcUserHR(existingSessions);

    let imported = 0;
    let skipped = 0;

    for (const raw of sessions) {
      if (!raw.parseable) { skipped++; continue; }

      const date = new Date(raw.start_time);
      const fingerprint = computeFingerprint(date, raw.duration_seconds);

      if (deletedSet.has(fingerprint) || existingDates.has(date.toISOString())) {
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
