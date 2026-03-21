import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/sessions/auth-helper";
import { computeFingerprint } from "@/lib/sessions/fingerprint";
import { UpdateSessionSchema } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { userId, error } = await getAuthenticatedUserId();
  if (error) return error;

  const { id } = await params;

  const session = await prisma.trainingSession.findFirst({
    where: { id, userId },
    include: {
      hrSamples: { orderBy: { timeOffsetSeconds: "asc" } },
      laps: { orderBy: { lapNumber: "asc" } },
      cardiacDrift: true,
      aiAnalyses: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  return NextResponse.json(session);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { userId, error } = await getAuthenticatedUserId();
  if (error) return error;

  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = UpdateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const session = await prisma.trainingSession.findFirst({ where: { id, userId } });
  if (!session) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  const updated = await prisma.trainingSession.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { userId, error } = await getAuthenticatedUserId();
  if (error) return error;

  const { id } = await params;

  const session = await prisma.trainingSession.findFirst({
    where: { id, userId },
    select: { date: true, duration: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  // Registrar fingerprint para evitar re-importación
  const fingerprint = computeFingerprint(session.date, session.duration);
  await prisma.$transaction([
    prisma.deletedSessionFingerprint.upsert({
      where: { userId_fingerprint: { userId, fingerprint } },
      create: { userId, fingerprint },
      update: {},
    }),
    prisma.trainingSession.delete({ where: { id } }),
  ]);

  return NextResponse.json({ deleted: true });
}
