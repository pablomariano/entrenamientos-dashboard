import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/sessions/auth-helper";
import { computeFingerprint } from "@/lib/sessions/fingerprint";
import { generateSessionTitle } from "@/lib/sessions/title";
import { calculateTRIMP, calcUserHR } from "@/lib/sessions/trimp";
import { ImportPayloadSchema } from "@/lib/schemas";
import type { Sport } from "@prisma/client";
import { calculateCardiacDrift } from "@/lib/sessions/cardiac-drift";

export async function POST(req: NextRequest) {
  const { userId, error } = await getAuthenticatedUserId();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = ImportPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });
  }

  const { sessions } = parsed.data;

  // Obtener fingerprints de sesiones eliminadas por este usuario
  const deletedFingerprints = await prisma.deletedSessionFingerprint.findMany({
    where: { userId },
    select: { fingerprint: true },
  });
  const deletedSet = new Set(deletedFingerprints.map((d) => d.fingerprint));

  // Obtener fechas de sesiones ya importadas para evitar duplicados
  const existingSessions = await prisma.trainingSession.findMany({
    where: { userId },
    select: { date: true, duration: true, hrMin: true, hrMax: true, hrAvg: true },
  });
  const existingFingerprints = new Set(
    existingSessions.map((s) => computeFingerprint(s.date, s.duration))
  );

  // Calcular hrRest y hrMax del usuario desde sesiones existentes
  const { hrRest, hrMax: userHrMax } = calcUserHR(existingSessions);

  let imported = 0;
  let skipped = 0;
  let skippedDeleted = 0;

  for (const raw of sessions) {
    if (!raw.parseable) { skipped++; continue; }

    const hasTimezone = raw.start_time.includes("Z") || /[+-]\d{2}:?\d{2}$/.test(raw.start_time);
    const date = new Date(hasTimezone ? raw.start_time : `${raw.start_time}Z`);
    const fingerprint = computeFingerprint(date, raw.duration_seconds);

    const rawHrAvg = raw.hr_avg ?? null;
    const rawHrMax = raw.hr_max ?? null;

    if (deletedSet.has(fingerprint)) { skippedDeleted++; continue; }

    const isDuplicate = existingFingerprints.has(fingerprint) || existingSessions.some((s) => {
      if (s.duration !== raw.duration_seconds) return false;
      const timeDiffMs = Math.abs(s.date.getTime() - date.getTime());
      const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
      if (timeDiffHours >= 25) return false;
      if (s.hrAvg != null && rawHrAvg != null && s.hrAvg !== rawHrAvg) return false;
      if (s.hrMax != null && rawHrMax != null && s.hrMax !== rawHrMax) return false;
      return true;
    });

    if (isDuplicate) { skipped++; continue; }

    // Detectar sport: si todas las muestras HR están en zona constante por >20min → SPINNING
    const sport: Sport = detectSport(raw.hr_samples ?? [], raw.duration_seconds);

    const hrAvg = raw.hr_avg ?? null;
    const hrMax = raw.hr_max ?? null;
    const hrMin = raw.hr_min ?? null;

    // Calcular TRIMP
    let trimp: number | null = null;
    if (hrAvg && hrMax) {
      trimp = calculateTRIMP(raw.duration_seconds, hrAvg, hrMax, hrRest, userHrMax);
    }

    const title = generateSessionTitle(date);

    const hrSamplesForDrift = (raw.hr_samples ?? [])
      .filter((s) => s.hr >= 40 && s.hr <= 250)
      .map((s) => ({ timeOffsetSeconds: Math.round(s.time_seconds), hr: s.hr }));

    const drift = sport === "SPINNING"
      ? calculateCardiacDrift(hrSamplesForDrift, raw.duration_seconds)
      : null;

    await prisma.trainingSession.create({
      data: {
        userId,
        title,
        date,
        duration: raw.duration_seconds,
        sport,
        hrAvg,
        hrMax,
        hrMin,
        trimp,
        hrSamples: raw.hr_samples
          ? {
              create: raw.hr_samples
                .filter((s) => s.hr >= 30 && s.hr <= 250)
                .map((s) => ({
                  timeOffsetSeconds: Math.round(s.time_seconds),
                  hr: s.hr,
                })),
            }
          : undefined,
        laps: raw.laps
          ? {
              create: raw.laps
                .filter((l) => l.lap_number != null)
                .map((l) => ({
                  lapNumber: l.lap_number,
                  startOffsetSeconds: Math.round(
                    l.time_seconds ?? l.approximate_time_seconds ?? 0
                  ),
                  durationSeconds: Math.round(l.duration_seconds ?? 0),
                })),
            }
          : undefined,
        cardiacDrift: drift
          ? { create: { ...drift } }
          : undefined,
      },
    });

    imported++;
  }

  return NextResponse.json({ imported, skipped, skippedDeleted, total: sessions.length });
}

/**
 * Detecta si una sesión es SPINNING basándose en variabilidad de HR.
 * Si el coeficiente de variación de HR es bajo (esfuerzo sostenido) → SPINNING.
 */
function detectSport(
  hrSamples: Array<{ time_seconds: number; hr: number }>,
  durationSeconds: number
): Sport {
  const validSamples = hrSamples.filter((s) => s.hr >= 30 && s.hr <= 250);
  if (validSamples.length < 20 || durationSeconds < 1200) return "MTB";

  const hrs = validSamples.map((s) => s.hr);
  const mean = hrs.reduce((a, b) => a + b, 0) / hrs.length;
  const variance = hrs.reduce((acc, v) => acc + (v - mean) ** 2, 0) / hrs.length;
  const cv = Math.sqrt(variance) / mean;

  // CV bajo (<0.08) indica esfuerzo constante → SPINNING probable
  return cv < 0.08 ? "SPINNING" : "MTB";
}
