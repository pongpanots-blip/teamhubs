import { readdir, readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import type { TeamDoc } from "@prisma/client";
import { embedTexts, vectorLiteral } from "@/lib/context/embeddings";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;
/** Cosine distance ceiling for a chunk to count as relevant (0 = identical, 2 = opposite). */
export const RAG_MAX_DISTANCE = Number(process.env.RAG_MAX_DISTANCE ?? 0.5);

export function chunkMarkdown(content: string): string[] {
  const paragraphs = content.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > CHUNK_SIZE && current) {
      chunks.push(current.trim());
      current = current.slice(-CHUNK_OVERLAP) + "\n\n" + para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [content.slice(0, CHUNK_SIZE)];
}

async function walkMarkdown(dir: string, base = dir): Promise<{ relative: string; content: string }[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: { relative: string; content: string }[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdown(full, base)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push({
        relative: path.relative(base, full).replace(/\\/g, "/"),
        content: await readFile(full, "utf8"),
      });
    }
  }
  return files;
}

/** Max size of a single uploaded doc. Markdown specs are text; anything larger is a mistake. */
export const MAX_DOC_BYTES = 1_000_000;

export class DocError extends Error {}

/** Normalise a filename/path into the stable `sourcePath` used by DocChunk. */
export function normalizeDocPath(input: string): string {
  const cleaned = input
    .replace(/\\/g, "/")
    .split("/")
    .filter((seg) => seg && seg !== "." && seg !== "..")
    .join("/")
    .trim();
  if (!cleaned) throw new DocError("INVALID_DOC_PATH");
  if (!/\.(md|markdown|txt)$/i.test(cleaned)) throw new DocError("UNSUPPORTED_DOC_TYPE");
  return cleaned;
}

/** First markdown heading, used as a display title. */
function extractTitle(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1]!.trim().slice(0, 200) : null;
}

/** Create or replace one team doc. Does not index — call indexTeamDoc after. */
export async function saveTeamDoc(
  teamId: string,
  rawPath: string,
  content: string,
  source: "upload" | "repo" = "upload",
): Promise<TeamDoc> {
  const docPath = normalizeDocPath(rawPath);
  const sizeBytes = Buffer.byteLength(content, "utf8");
  if (sizeBytes === 0) throw new DocError("EMPTY_DOC");
  if (sizeBytes > MAX_DOC_BYTES) throw new DocError("DOC_TOO_LARGE");

  const data = { content, sizeBytes, source, title: extractTitle(content), indexedAt: null };
  return prisma.teamDoc.upsert({
    where: { teamId_path: { teamId, path: docPath } },
    create: { teamId, path: docPath, ...data },
    update: data,
  });
}

/** Chunk + embed one doc, replacing any chunks it previously produced. */
export async function indexTeamDoc(doc: TeamDoc): Promise<number> {
  const chunks = chunkMarkdown(doc.content);
  const embeddings = await embedTexts(chunks);

  await prisma.docChunk.deleteMany({
    where: { teamId: doc.teamId, sourcePath: doc.path },
  });

  for (let i = 0; i < chunks.length; i++) {
    const created = await prisma.docChunk.create({
      data: {
        teamId: doc.teamId,
        sourcePath: doc.path,
        content: chunks[i]!,
        chunkIndex: i,
        metadata: { chars: chunks[i]!.length, docId: doc.id, title: doc.title },
      },
    });
    await prisma.$executeRawUnsafe(
      `UPDATE "DocChunk" SET embedding = $1::vector WHERE id = $2`,
      vectorLiteral(embeddings[i]!),
      created.id,
    );
  }

  await prisma.teamDoc.update({
    where: { id: doc.id },
    data: { indexedAt: new Date() },
  });
  return chunks.length;
}

/** Re-embed every doc the team owns. */
export async function reindexTeamDocs(teamId: string) {
  const docs = await prisma.teamDoc.findMany({ where: { teamId }, orderBy: { path: "asc" } });
  let chunks = 0;
  for (const doc of docs) {
    chunks += await indexTeamDoc(doc);
  }
  // Drop chunks left behind by docs that no longer exist.
  const paths = docs.map((d) => d.path);
  await prisma.docChunk.deleteMany({
    where: { teamId, ...(paths.length ? { sourcePath: { notIn: paths } } : {}) },
  });
  return { files: docs.length, chunks };
}

export async function deleteTeamDoc(teamId: string, rawPath: string) {
  const docPath = normalizeDocPath(rawPath);
  const deleted = await prisma.teamDoc.deleteMany({ where: { teamId, path: docPath } });
  if (deleted.count === 0) throw new DocError("DOC_NOT_FOUND");
  await prisma.docChunk.deleteMany({ where: { teamId, sourcePath: docPath } });
}

/**
 * Seed a team from the repo's own `docs/**` — a bootstrap convenience only.
 * Real teams upload their own docs; these land as TeamDoc rows like any other.
 */
export async function importRepoDocsForTeam(teamId: string, docsRoot?: string) {
  const root = docsRoot ?? path.join(process.cwd(), "docs");
  const files = await walkMarkdown(root);

  let chunks = 0;
  for (const file of files) {
    const doc = await saveTeamDoc(teamId, file.relative, file.content, "repo");
    chunks += await indexTeamDoc(doc);
  }
  return { files: files.length, chunks };
}

export type RetrievedChunk = {
  id: string;
  sourcePath: string;
  content: string;
  chunkIndex: number;
  distance: number;
};

export async function retrieveRelevantChunks(
  teamId: string,
  query: string,
  topK = 6,
  maxDistance = RAG_MAX_DISTANCE,
): Promise<RetrievedChunk[]> {
  const [embedding] = await embedTexts([query]);
  // Plain ORDER BY + LIMIT so the HNSW index (DocChunk_embedding_hnsw_idx) is
  // usable; a WHERE on the distance expression would force a sequential scan.
  const rows = await prisma.$queryRawUnsafe<
    { id: string; sourcePath: string; content: string; chunkIndex: number; distance: number }[]
  >(
    `SELECT id, "sourcePath", content, "chunkIndex", (embedding <=> $1::vector) AS distance
     FROM "DocChunk"
     WHERE "teamId" = $2 AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    vectorLiteral(embedding!),
    teamId,
    topK,
  );
  // Drop chunks that are merely the least-bad match — they are noise to Claude.
  return rows.filter((row) => row.distance <= maxDistance);
}
