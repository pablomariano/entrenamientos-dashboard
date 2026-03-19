/**
 * Codifica start_time para usarlo como ID en la URL.
 * Usa ~ y _ (no aparecen en ISO 8601) para evitar branching server/client.
 */
export function encodeSessionId(startTime: string): string {
  return startTime.replace(/:/g, "~").replace(/\./g, "_");
}

/**
 * Decodifica el sessionId de la URL para obtener start_time.
 */
export function decodeSessionId(sessionId: string): string {
  try {
    return sessionId.replace(/~/g, ":").replace(/_/g, ".");
  } catch {
    return "";
  }
}
