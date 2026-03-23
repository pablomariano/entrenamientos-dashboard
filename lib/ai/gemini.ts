// ---------------------------------------------------------------------------
// Gemini (Google)
// ---------------------------------------------------------------------------
const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite"];
const GEMINI_BASE = "https://generativelanguage.googleapis.com";
const GEMINI_API_VERSION = "v1beta";
const MAX_RETRY_WAIT_MS = 5_000;

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

function parseGeminiRetryDelay(errBody: Record<string, unknown>): number | null {
  try {
    const details = (errBody?.error as Record<string, unknown>)?.details as Array<Record<string, unknown>>;
    for (const d of details ?? []) {
      if (d["@type"]?.toString().includes("RetryInfo")) {
        const delay = d.retryDelay as string | undefined;
        if (delay) return Math.ceil(parseFloat(delay) * 1000);
      }
    }
  } catch { /* ignore */ }
  return null;
}

async function tryGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");

  let lastError: Error | null = null;

  for (const model of GEMINI_MODELS) {
    const url = `${GEMINI_BASE}/${GEMINI_API_VERSION}/models/${model}:generateContent?key=${apiKey}`;
    try {
      const body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      });

      let res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as Record<string, unknown>;
        const msg = (errBody?.error as Record<string, unknown>)?.message as string ?? res.statusText;

        if (res.status === 429) {
          const waitMs = parseGeminiRetryDelay(errBody);
          if (waitMs && waitMs <= MAX_RETRY_WAIT_MS) {
            console.log(`[Gemini] ${model}: cuota excedida, reintentando en ${Math.ceil(waitMs / 1000)}s...`);
            await sleep(waitMs);
            res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
            if (res.ok) {
              const data = await res.json();
              const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
              if (text) return text;
            }
          }
          lastError = new Error(`[Gemini:${model}] Cuota excedida: ${msg}`);
          continue;
        }
        if (res.status === 404) {
          lastError = new Error(`[Gemini:${model}] Modelo no disponible`);
          continue;
        }
        throw new Error(`[Gemini:${model}] Error ${res.status}: ${msg}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
      if (text) return text;
      throw new Error(`[Gemini:${model}] Respuesta vacía`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("Gemini: todos los modelos fallaron");
}

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

// ---------------------------------------------------------------------------
// Función principal: intenta Gemini y hace fallback a DeepSeek
// ---------------------------------------------------------------------------
/**
 * Genera texto usando IA. Intenta Gemini primero; si falla por cuota o
 * configuración, usa DeepSeek como fallback automático.
 */
export async function generateText(prompt: string): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;

  if (geminiKey) {
    try {
      const result = await tryGemini(prompt);
      console.log("[AI] Respuesta generada con Gemini");
      return result;
    } catch (err) {
      console.warn("[AI] Gemini falló, intentando DeepSeek...", err instanceof Error ? err.message : err);
    }
  }

  if (deepseekKey) {
    const result = await tryDeepSeek(prompt);
    console.log("[AI] Respuesta generada con DeepSeek");
    return result;
  }

  throw new Error("No hay proveedor de IA disponible. Configura GEMINI_API_KEY o DEEPSEEK_API_KEY en el .env");
}

