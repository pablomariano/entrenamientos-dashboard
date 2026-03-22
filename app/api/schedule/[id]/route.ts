import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/sessions/auth-helper";
import { UpdateScheduledTrainingSchema } from "@/lib/schemas";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { userId, error } = await getAuthenticatedUserId();
  if (error) return error;

  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = UpdateScheduledTrainingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const training = await prisma.scheduledTraining.findFirst({ where: { id, userId } });
  if (!training) {
    return NextResponse.json({ error: "Entrenamiento no encontrado" }, { status: 404 });
  }

  const { date, linkedSessionId, ...rest } = parsed.data;

  const updated = await prisma.scheduledTraining.update({
    where: { id },
    data: {
      ...rest,
      ...(date ? { date: new Date(date) } : {}),
      ...(linkedSessionId !== undefined ? { linkedSessionId } : {}),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { userId, error } = await getAuthenticatedUserId();
  if (error) return error;

  const { id } = await params;

  const training = await prisma.scheduledTraining.findFirst({ where: { id, userId } });
  if (!training) {
    return NextResponse.json({ error: "Entrenamiento no encontrado" }, { status: 404 });
  }

  await prisma.scheduledTraining.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
