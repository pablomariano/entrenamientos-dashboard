/**
 * Calcula la deriva cardíaca para sesiones de spinning.
 *
 * Método: se toma el 60% central de la sesión como "estado estable",
 * se divide en dos mitades y se compara la FC media de cada una.
 * Derive % > 0 significa que el corazón trabajó más al final (fatiga).
 */
export interface CardiacDriftResult {
  hrStart: number;
  hrEnd: number;
  driftPercent: number;
  steadyStateDurationSeconds: number;
}

export function calculateCardiacDrift(
  hrSamples: Array<{ timeOffsetSeconds: number; hr: number }>,
  totalDurationSeconds: number
): CardiacDriftResult | null {
  const valid = hrSamples
    .filter((s) => s.hr >= 40 && s.hr <= 250)
    .sort((a, b) => a.timeOffsetSeconds - b.timeOffsetSeconds);

  if (valid.length < 30) return null;

  // Estado estable: 20%–80% de la sesión
  const ssStart = totalDurationSeconds * 0.2;
  const ssEnd = totalDurationSeconds * 0.8;
  const steadyStateDurationSeconds = Math.round(ssEnd - ssStart);

  const sssamples = valid.filter(
    (s) => s.timeOffsetSeconds >= ssStart && s.timeOffsetSeconds <= ssEnd
  );

  if (sssamples.length < 20) return null;

  const midpoint = ssStart + (ssEnd - ssStart) / 2;
  const firstHalf = sssamples.filter((s) => s.timeOffsetSeconds < midpoint);
  const secondHalf = sssamples.filter((s) => s.timeOffsetSeconds >= midpoint);

  if (firstHalf.length < 5 || secondHalf.length < 5) return null;

  const avg = (samples: typeof sssamples) =>
    Math.round(samples.reduce((a, s) => a + s.hr, 0) / samples.length);

  const hrStart = avg(firstHalf);
  const hrEnd = avg(secondHalf);
  const driftPercent = ((hrEnd - hrStart) / hrStart) * 100;

  return {
    hrStart,
    hrEnd,
    driftPercent: Math.round(driftPercent * 10) / 10,
    steadyStateDurationSeconds,
  };
}
