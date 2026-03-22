import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/sessions/auth-helper";
import { CreateScheduledTrainingSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  const { userId, error } = await getAuthenticatedUserId();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const completed = searchParams.get("completed");

  const trainings = await prisma.scheduledTraining.findMany({
    where: {
      userId,
      ...(from || to
        ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
      ...(completed !== null ? { completed: completed === "true" } : {}),
    },
    orderBy: { date: "asc" },
    include: { linkedSession: { select: { id: true, title: true, sport: true, hrAvg: true, trimp: true } } },
  });

  return NextResponse.json(trainings);
}

export async function POST(req: NextRequest) {
  const { userId, error } = await getAuthenticatedUserId();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = CreateScheduledTrainingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const training = await prisma.scheduledTraining.create({
    data: { userId, ...parsed.data, date: new Date(parsed.data.date) },
  });

  return NextResponse.json(training, { status: 201 });
}
