import { createHash } from "crypto";

/**
 * Calcula un fingerprint único para una sesión a partir de su fecha y duración.
 * Se usa para evitar re-importar sesiones que el usuario ya eliminó.
 */
export function computeFingerprint(date: Date, durationSeconds: number): string {
  const raw = `${date.toISOString()}::${durationSeconds}`;
  return createHash("sha256").update(raw).digest("hex");
}
