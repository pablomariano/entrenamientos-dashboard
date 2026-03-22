import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/sessions/auth-helper";
import type { Sport } from "@/generated/prisma";

export async function GET(req: NextRequest) {
  const { userId, error } = await getAuthenticatedUserId();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const sport = searchParams.get("sport") as Sport | null;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const sessions = await prisma.trainingSession.findMany({
    where: {
      userId,
      ...(sport ? { sport } : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { date: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      title: true,
      date: true,
      duration: true,
      sport: true,
      hrAvg: true,
      hrMax: true,
      hrMin: true,
      trimp: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(sessions);
}
