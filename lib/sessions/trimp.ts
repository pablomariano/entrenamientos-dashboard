/**
 * Calcula el TRIMP de Banister para una sesión.
 * TRIMP = duración_min × ΔHR × 0.64 × e^(1.92 × ΔHR)
 * ΔHR = (hrAvg - hrRest) / (hrMax - hrRest)
 */
export function calculateTRIMP(
  durationSeconds: number,
  hrAvg: number,
  hrMaxSession: number,
  hrRest: number,
  hrMaxUser: number
): number {
  const effectiveHrMax = Math.max(hrMaxSession, hrMaxUser);
  if (hrAvg <= hrRest || effectiveHrMax <= hrRest) return 0;

  const deltaHR = Math.max(0, Math.min(1, (hrAvg - hrRest) / (effectiveHrMax - hrRest)));
  const durationMin = durationSeconds / 60;
  return durationMin * deltaHR * 0.64 * Math.exp(1.92 * deltaHR);
}

/**
 * Calcula hrRest y hrMax desde un array de valores mínimos/máximos de sesiones.
 */
export function calcUserHR(
  sessions: Array<{ hrMin: number | null; hrMax: number | null }>
): { hrRest: number; hrMax: number } {
  const mins = sessions.map((s) => s.hrMin).filter((v): v is number => v !== null && v > 30);
  const maxs = sessions.map((s) => s.hrMax).filter((v): v is number => v !== null && v > 30);

  return {
    hrRest: mins.length > 0 ? Math.min(...mins) : 60,
    hrMax: maxs.length > 0 ? Math.max(...maxs) : 190,
  };
}
