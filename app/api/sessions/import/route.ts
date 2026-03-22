import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/sessions/auth-helper";
import { computeFingerprint } from "@/lib/sessions/fingerprint";
import { generateSessionTitle } from "@/lib/sessions/title";
import { calculateTRIMP, calcUserHR } from "@/lib/sessions/trimp";
import { ImportPayloadSchema } from "@/lib/schemas";
import type { Sport } from "@/generated/prisma";
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
    select: { date: true, hrMin: true, hrMax: true },
  });
  const existingDates = new Set(existingSessions.map((s) => s.date.toISOString()));

  // Calcular hrRest y hrMax del usuario desde sesiones existentes
  const { hrRest, hrMax: userHrMax } = calcUserHR(existingSessions);

  let imported = 0;
  let skipped = 0;
  let skippedDeleted = 0;

  for (const raw of sessions) {
    if (!raw.parseable) { skipped++; continue; }

    const date = new Date(raw.start_time);
    const fingerprint = computeFingerprint(date, raw.duration_seconds);

    if (deletedSet.has(fingerprint)) { skippedDeleted++; continue; }
    if (existingDates.has(date.toISOString())) { skipped++; continue; }

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
