// ---------------------------------------------------------------------------
// DeepSeek (OpenAI-compatible)
// ---------------------------------------------------------------------------
const DEEPSEEK_BASE = "https://api.deepseek.com";
const DEEPSEEK_MODEL = "deepseek-chat";

async function tryDeepSeek(prompt: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY no configurada");

  const res = await fetch(`${DEEPSEEK_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = (errBody?.error as Record<string, unknown>)?.message as string ?? res.statusText;
    throw new Error(`[DeepSeek] Error ${res.status}: ${msg}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content as string | undefined;
  if (!text) throw new Error("[DeepSeek] Respuesta vacía");
  return text;
}

/**
 * Genera texto usando IA con DeepSeek.
 */
export async function generateText(prompt: string): Promise<string> {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;

  if (deepseekKey) {
    const result = await tryDeepSeek(prompt);
    console.log("[AI] Respuesta generada con DeepSeek");
    return result;
  }

  throw new Error("No hay proveedor de IA disponible. Configura DEEPSEEK_API_KEY en el .env");
}

