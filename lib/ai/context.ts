import prisma from "@/lib/prisma";
import { calcUserHR } from "@/lib/sessions/trimp";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Construye un resumen estructurado del historial de entrenamiento del usuario
 * para inyectar como contexto en los prompts de Gemini.
 */
export async function buildTrainingContext(userId: string): Promise<string> {
  const [recentSessions, allHR, driftRecords, upcomingScheduled] = await Promise.all([
    prisma.trainingSession.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 10,
      select: {
        date: true,
        title: true,
        sport: true,
        duration: true,
        hrAvg: true,
        hrMax: true,
        hrMin: true,
        trimp: true,
      },
    }),
    prisma.trainingSession.findMany({
      where: { userId },
      select: { hrMin: true, hrMax: true },
    }),
    prisma.cardiacDrift.findMany({
      where: { session: { userId } },
      orderBy: { session: { date: "desc" } },
      take: 5,
      select: {
        driftPercent: true,
        hrStart: true,
        hrEnd: true,
        steadyStateDurationSeconds: true,
        session: { select: { date: true } },
      },
    }),
    prisma.scheduledTraining.findMany({
      where: { userId, completed: false, date: { gte: new Date() } },
      orderBy: { date: "asc" },
      take: 5,
      select: { date: true, sport: true, durationPlanned: true, notes: true },
    }),
  ]);

  const { hrRest, hrMax } = calcUserHR(allHR);

  // Calcular TRIMP semanal (últimas 4 semanas)
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const weeklyTrimp: Record<string, number> = {};
  for (const s of recentSessions) {
    if (s.date < fourWeeksAgo) continue;
    const weekKey = `Semana del ${format(s.date, "d MMM", { locale: es })}`;
    weeklyTrimp[weekKey] = (weeklyTrimp[weekKey] ?? 0) + (s.trimp ?? 0);
  }

  const lines: string[] = [
    "=== CONTEXTO DE ENTRENAMIENTO ===",
    "",
    `HR calculada del usuario: FC Máxima histórica = ${hrMax} bpm | FC Reposo estimada = ${hrRest} bpm`,
    "",
    "--- Últimas 10 sesiones ---",
  ];

  for (const s of recentSessions) {
    const dateStr = format(s.date, "d/M/yy", { locale: es });
    const dur = Math.round(s.duration / 60);
    const hr = s.hrAvg ? `FC${s.hrAvg}` : "";
    const trimp = s.trimp ? `T${s.trimp.toFixed(0)}` : "";
    lines.push(`• ${dateStr} ${s.sport} ${dur}m ${hr} ${trimp}`.trim());
  }

  lines.push("", "--- TRIMP por semana (últimas 4 semanas) ---");
  for (const [week, trimp] of Object.entries(weeklyTrimp)) {
    lines.push(`• ${week}: ${trimp.toFixed(1)}`);
  }

  if (driftRecords.length > 0) {
    lines.push("", "--- Deriva cardíaca en spinning (más recientes) ---");
    for (const d of driftRecords) {
      const dateStr = format(d.session.date, "d MMM yyyy", { locale: es });
      const dir = d.driftPercent > 0 ? "↑" : "↓";
      lines.push(
        `• ${dateStr}: deriva ${dir}${Math.abs(d.driftPercent).toFixed(1)}% | FC inicio ${d.hrStart} → FC fin ${d.hrEnd} bpm | ${Math.round(d.steadyStateDurationSeconds / 60)} min estado estable`
      );
    }
  }

  if (upcomingScheduled.length > 0) {
    lines.push("", "--- Entrenamientos programados próximos ---");
    for (const s of upcomingScheduled) {
      const dateStr = format(s.date, "EEEE d MMM", { locale: es });
      const dur = s.durationPlanned ? `${s.durationPlanned} min` : "sin duración";
      lines.push(`• ${dateStr}: ${s.sport} | ${dur}${s.notes ? ` | ${s.notes}` : ""}`);
    }
  }

  lines.push("", "=== FIN CONTEXTO ===");
  return lines.join("\n");
}
