import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Obtiene el userId del usuario autenticado.
 * Si no hay sesión activa, retorna una respuesta 401.
 */
export async function getAuthenticatedUserId(): Promise<
  { userId: string; error: null } | { userId: null; error: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      userId: null,
      error: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }
  return { userId: session.user.id, error: null };
}
