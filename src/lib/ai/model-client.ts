import { GoogleGenAI } from "@google/genai";

/**
 * Single entry point every AI call site in TeamHub goes through.
 * Provider: Gemini only. For each model in the fallback chain (GEMINI_MODELS,
 * comma-separated; defaults to flash then pro), tries every configured API
 * key (GEMINI_API_KEYS, comma-separated — falls back to single GEMINI_API_KEY)
 * before moving to the next model. Only advances on a capacity/rate-limit
 * error — never on a content or parsing error, so a bad prompt fails fast
 * instead of silently retrying under a different key/model.
 */
export type ModelMessage = { role: "user" | "assistant"; content: string };

const DEFAULT_MODELS = ["gemini-3.6-flash", "gemini-pro-latest"];

function apiKeys(): string[] {
  const list = process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY ?? "";
  return list
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

export function hasAiKey(): boolean {
  return apiKeys().length > 0;
}

/** The model hit maxOutputTokens before finishing — the text is genuinely incomplete. */
export class ResponseTruncatedError extends Error {
  constructor(model: string) {
    super(`${model} response was truncated at maxOutputTokens`);
  }
}

/**
 * Extracts the first balanced JSON value (object or array) from free-form
 * model output — tolerant of markdown code fences and trailing prose, and
 * much less likely than a greedy `/\{[\s\S]*\}/` regex to grab garbage past
 * the real JSON's closing brace. Throws if no balanced value is found.
 */
export function extractBalancedJson(text: string): string {
  const stripped = text.replace(/```(?:json)?/gi, "");
  const start = stripped.search(/[{[]/);
  if (start === -1) throw new Error("No JSON object/array found in model output");

  const open = stripped[start]!;
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return stripped.slice(start, i + 1);
    }
  }
  throw new Error("Unbalanced JSON in model output (likely truncated)");
}

function isCapacityError(e: unknown): boolean {
  const status = (e as { status?: number } | null)?.status;
  const message = e instanceof Error ? e.message : String(e);
  return (
    status === 429 ||
    status === 503 ||
    /rate.?limit|quota|resource_exhausted|overloaded|high demand|unavailable|try again later|"code":\s*(429|503)/i.test(
      message,
    )
  );
}

export async function callModel(input: {
  system: string;
  messages: ModelMessage[];
  maxTokens: number;
}): Promise<string> {
  const keys = apiKeys();
  if (keys.length === 0) throw new Error("GEMINI_API_KEY(S) not set");

  const models = (process.env.GEMINI_MODELS ?? DEFAULT_MODELS.join(","))
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (models.length === 0) throw new Error("GEMINI_MODELS resolved to an empty list");

  const contents = input.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : ("user" as const),
    parts: [{ text: m.content }],
  }));

  let lastError: unknown;

  for (const model of models) {
    for (const apiKey of keys) {
      try {
        const client = new GoogleGenAI({ apiKey });
        const response = await client.models.generateContent({
          model,
          config: { systemInstruction: input.system, maxOutputTokens: input.maxTokens },
          contents,
        });
        const text = response.text;
        if (!text) throw new Error(`${model} returned no text`);
        if (response.candidates?.[0]?.finishReason === "MAX_TOKENS") {
          throw new ResponseTruncatedError(model);
        }
        return text;
      } catch (e) {
        lastError = e;
        if (!isCapacityError(e)) throw e;
        // this key is rate-limited/out of quota for this model — try the next key,
        // then the next model once every key has been tried
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All Gemini models/keys exhausted");
}
