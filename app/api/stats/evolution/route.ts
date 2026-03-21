import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/sessions/auth-helper";
import { calcUserHR } from "@/lib/sessions/trimp";
import { startOfWeek, subWeeks, addDays, format } from "date-fns";

export async function GET(req: NextRequest) {
  const { userId, error } = await getAuthenticatedUserId();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const weeks = Math.min(parseInt(searchParams.get("weeks") ?? "12", 10), 52);

  const since = subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weeks - 1);

  const sessions = await prisma.trainingSession.findMany({
    where: { userId, date: { gte: since } },
    select: {
      date: true,
      duration: true,
      sport: true,
      hrAvg: true,
      hrMax: true,
      hrMin: true,
      trimp: true,
    },
    orderBy: { date: "asc" },
  });

  // Calcular hrMax y hrRest globales del usuario
  const allHR = await prisma.trainingSession.findMany({
    where: { userId },
    select: { hrMin: true, hrMax: true },
  });
  const { hrRest, hrMax } = calcUserHR(allHR);

  // Agrupar por semana
  const weekMap = new Map<string, {
    sessions: number;
    totalDuration: number;
    totalTrimp: number;
    hrValues: number[];
    maxHrValues: number[];
  }>();

  for (let i = 0; i < weeks; i++) {
    const weekStart = format(addDays(since, i * 7), "yyyy-MM-dd");
    weekMap.set(weekStart, { sessions: 0, totalDuration: 0, totalTrimp: 0, hrValues: [], maxHrValues: [] });
  }

  for (const s of sessions) {
    const weekStart = format(startOfWeek(s.date, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const bucket = weekMap.get(weekStart);
    if (!bucket) continue;
    bucket.sessions++;
    bucket.totalDuration += s.duration;
    bucket.totalTrimp += s.trimp ?? 0;
    if (s.hrAvg) bucket.hrValues.push(s.hrAvg);
    if (s.hrMax) bucket.maxHrValues.push(s.hrMax);
  }

  const weekly = Array.from(weekMap.entries()).map(([weekStart, b]) => ({
    weekStart,
    sessions: b.sessions,
    totalDuration: b.totalDuration,
    totalTrimp: Math.round(b.totalTrimp * 10) / 10,
    avgHr: b.hrValues.length > 0
      ? Math.round(b.hrValues.reduce((a, v) => a + v, 0) / b.hrValues.length)
      : null,
    maxHr: b.maxHrValues.length > 0 ? Math.max(...b.maxHrValues) : null,
  }));

  // Tendencia de deriva cardíaca (sesiones SPINNING)
  const driftRecords = await prisma.cardiacDrift.findMany({
    where: { session: { userId } },
    select: { driftPercent: true, session: { select: { date: true } } },
    orderBy: { session: { date: "asc" } },
  });

  const cardiacDriftTrend = driftRecords.map((d) => ({
    date: format(d.session.date, "yyyy-MM-dd"),
    driftPercent: Math.round(d.driftPercent * 10) / 10,
  }));

  return NextResponse.json({ weekly, cardiacDriftTrend, hrCalculated: { hrMax, hrRest } });
}
