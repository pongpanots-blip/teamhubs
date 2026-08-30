import { NextResponse } from "next/server";
import { requireMembership, assertRole } from "@/lib/auth-session";
import {
  DocError,
  MAX_DOC_BYTES,
  deleteTeamDoc,
  indexTeamDoc,
  saveTeamDoc,
} from "@/lib/context/ingest";
import { prisma } from "@/lib/db";

const MAX_FILES_PER_REQUEST = 20;

async function listDocs(teamId: string) {
  const [docs, counts] = await Promise.all([
    prisma.teamDoc.findMany({
      where: { teamId },
      orderBy: { path: "asc" },
      select: {
        path: true,
        title: true,
        source: true,
        sizeBytes: true,
        indexedAt: true,
        updatedAt: true,
      },
    }),
    prisma.docChunk.groupBy({
      by: ["sourcePath"],
      where: { teamId },
      _count: { id: true },
    }),
  ]);
  const chunkByPath = new Map(counts.map((c) => [c.sourcePath, c._count.id]));
  return docs.map((d) => ({ ...d, chunks: chunkByPath.get(d.path) ?? 0 }));
}

export async function GET() {
  try {
    const { membership } = await requireMembership();
    return NextResponse.json({ docs: await listDocs(membership.teamId) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Upload one or more markdown docs (multipart/form-data, field name `files`). */
export async function POST(req: Request) {
  try {
    const { membership } = await requireMembership();
    assertRole(membership.role, ["pm", "dev", "ui"]);

    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) throw new DocError("NO_FILES");
    if (files.length > MAX_FILES_PER_REQUEST) throw new DocError("TOO_MANY_FILES");

    const indexed: { path: string; chunks: number }[] = [];
    for (const file of files) {
      if (file.size > MAX_DOC_BYTES) throw new DocError("DOC_TOO_LARGE");
      const doc = await saveTeamDoc(membership.teamId, file.name, await file.text());
      indexed.push({ path: doc.path, chunks: await indexTeamDoc(doc) });
    }

    return NextResponse.json({ indexed, docs: await listDocs(membership.teamId) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { membership } = await requireMembership();
    assertRole(membership.role, ["pm", "dev", "ui"]);
    const docPath = new URL(req.url).searchParams.get("path");
    if (!docPath) throw new DocError("MISSING_PATH");
    await deleteTeamDoc(membership.teamId, docPath);
    return NextResponse.json({ docs: await listDocs(membership.teamId) });
  } catch (e) {
    return errorResponse(e);
  }
}

function errorResponse(e: unknown) {
  const msg = e instanceof Error ? e.message : "ERROR";
  const status = e instanceof DocError ? 400 : msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
  if (status === 500) console.error(e);
  return NextResponse.json({ error: msg }, { status });
}
