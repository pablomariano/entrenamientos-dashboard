import { createHash } from "crypto";

/**
 * Calcula un fingerprint único para una sesión a partir de su fecha y duración.
 * Se usa para evitar re-importar sesiones que el usuario ya eliminó.
 */
export function computeFingerprint(date: Date, durationSeconds: number): string {
  // Truncate to second precision to avoid mismatches between timestamps
  // with/without milliseconds (e.g. "2024-01-15T10:30:00Z" vs "2024-01-15T10:30:00.000Z")
  const secondsPrecision = Math.floor(date.getTime() / 1000);
  const raw = `${secondsPrecision}::${Math.round(durationSeconds)}`;
  return createHash("sha256").update(raw).digest("hex");
}
