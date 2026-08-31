"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type TeamDocSummary = {
  path: string;
  title: string | null;
  source: "upload" | "repo";
  sizeBytes: number;
  indexedAt: string | null;
  chunks: number;
};

type DocsResponse = { error?: string; docs?: TeamDocSummary[] };

const ERROR_MESSAGES: Record<string, string> = {
  NO_FILES: "Pick at least one file",
  TOO_MANY_FILES: "Too many files in one upload (max 20)",
  DOC_TOO_LARGE: "File is too large (max 1 MB)",
  EMPTY_DOC: "File is empty",
  UNSUPPORTED_DOC_TYPE: "Only .md, .markdown and .txt files are supported",
  DOC_NOT_FOUND: "Doc no longer exists",
  FORBIDDEN: "You do not have permission to change docs",
};

export function DocsIngestPanel({
  initialDocs,
  projectSlug,
}: {
  initialDocs: TeamDocSummary[];
  projectSlug: string;
}) {
  const [docs, setDocs] = useState(initialDocs);
  // Docs are per-project, so every call names the project explicitly.
  const q = `project=${encodeURIComponent(projectSlug)}`;
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function run<T>(label: string, fn: () => Promise<Response>, done: (data: T) => string) {
    setBusy(label);
    setMessage(null);
    setError(null);
    try {
      const res = await fn();
      const data = (await res.json().catch(() => ({}))) as DocsResponse & T;
      if (!res.ok) {
        const code = data.error ?? "Request failed";
        setError(ERROR_MESSAGES[code] ?? code);
        return;
      }
      if (data.docs) setDocs(data.docs);
      else await refresh();
      setMessage(done(data));
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    const res = await fetch(`/api/docs?${q}`);
    const data = await res.json();
    if (res.ok) setDocs(data.docs);
  }

  async function upload(files: FileList) {
    const form = new FormData();
    for (const file of Array.from(files)) form.append("files", file);
    await run<{ indexed: { chunks: number }[] }>(
      "upload",
      () => fetch(`/api/docs?${q}`, { method: "POST", body: form }),
      (data: { indexed: { chunks: number }[] }) =>
        `Uploaded ${data.indexed.length} file(s) → ${data.indexed.reduce((s, i) => s + i.chunks, 0)} chunks`,
    );
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Docs / RAG</h1>
          <p className="text-sm text-slate-600">
            Your team&apos;s knowledge base. Only the most relevant chunks are ever sent to Claude.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".md,.markdown,.txt"
            className="hidden"
            onChange={(e) => e.target.files?.length && upload(e.target.files)}
          />
          <Button onClick={() => fileInput.current?.click()} disabled={busy !== null}>
            {busy === "upload" ? "Uploading…" : "Upload docs"}
          </Button>
          <Button
            variant="outline"
            disabled={busy !== null || docs.length === 0}
            onClick={() =>
              run<{ files: number; chunks: number }>(
                "reindex",
                () => fetch(`/api/docs/ingest?${q}`, { method: "POST" }),
                (data) =>
                  `Re-indexed ${data.files} docs → ${data.chunks} chunks`,
              )
            }
          >
            {busy === "reindex" ? "Re-indexing…" : "Re-index all"}
          </Button>
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              run<{ files: number; chunks: number }>(
                "seed",
                () => fetch(`/api/docs/ingest?source=repo&${q}`, { method: "POST" }),
                (data) =>
                  `Imported ${data.files} sample docs → ${data.chunks} chunks`,
              )
            }
          >
            {busy === "seed" ? "Importing…" : "Import samples"}
          </Button>
        </div>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card className="border-black/5 bg-white/80">
        <CardHeader>
          <CardTitle className="text-base">Indexed docs</CardTitle>
          <CardDescription>Chunks stored in PostgreSQL + pgvector, scoped to this team</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {docs.length === 0 ? (
            <p className="text-sm text-slate-500">
              No docs yet. Upload your <code className="rounded bg-black/5 px-1">.md</code> specs —
              e.g. coupon.md, payment.md, checkout.md.
            </p>
          ) : (
            docs.map((doc) => (
              <div key={doc.path} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{doc.path}</p>
                  {doc.title ? <p className="truncate text-xs text-slate-500">{doc.title}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-3 text-slate-500">
                  <span>{doc.chunks} chunks</span>
                  <span className="text-xs">{Math.max(1, Math.round(doc.sizeBytes / 1024))} KB</span>
                  {doc.indexedAt ? null : <span className="text-xs text-amber-600">not indexed</span>}
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    disabled={busy !== null}
                    onClick={() =>
                      run(
                        `delete:${doc.path}`,
                        () => fetch(`/api/docs?${q}&path=${encodeURIComponent(doc.path)}`, { method: "DELETE" }),
                        () => `Deleted ${doc.path}`,
                      )
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

