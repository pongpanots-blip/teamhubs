import { createHash } from "crypto";

const DIMS = Number(process.env.EMBEDDING_DIMS ?? 1536);

/** Deterministic local embedding for offline smoke / CI without API keys. */
export function localEmbed(text: string, dims = DIMS): number[] {
  const vec = new Array<number>(dims).fill(0);
  const tokens = text.toLowerCase().split(/[^a-z0-9ก-๙]+/i).filter(Boolean);
  for (const token of tokens) {
    const hash = createHash("sha256").update(token).digest();
    for (let i = 0; i < dims; i++) {
      const byte = hash[i % hash.length]!;
      vec[i]! += ((byte / 255) * 2 - 1) / Math.sqrt(tokens.length || 1);
    }
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const provider = process.env.EMBEDDING_PROVIDER ?? "local";

  if (provider === "voyage" && process.env.VOYAGE_API_KEY) {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        input: texts,
        model: "voyage-3-lite",
        input_type: "document",
      }),
    });
    if (!res.ok) {
      throw new Error(`Voyage embeddings failed: ${await res.text()}`);
    }
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data.map((d) => padOrTrim(d.embedding, DIMS));
  }

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        input: texts,
        model: "text-embedding-3-small",
        dimensions: DIMS,
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI embeddings failed: ${await res.text()}`);
    }
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data.map((d) => d.embedding);
  }

  return texts.map((t) => localEmbed(t));
}

function padOrTrim(vec: number[], dims: number): number[] {
  if (vec.length === dims) return vec;
  if (vec.length > dims) return vec.slice(0, dims);
  return [...vec, ...new Array(dims - vec.length).fill(0)];
}

export function vectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
