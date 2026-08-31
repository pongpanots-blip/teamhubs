"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { TaskStatusBadge } from "@/components/tasks/status-badge";
import { resolveRecommendation } from "@/lib/ai/grill-recommendation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TASK_PRIORITY_LABEL,
  TASK_COMPONENT_LABEL,
  COMPONENT_TO_ROLE,
  TASK_STATUSES,
  type TaskPriorityValue,
  type TaskStatusValue,
  TASK_STATUS_LABEL,
} from "@/lib/task-constants";
import { taskStatusStyle } from "@/lib/task-status-style";
import { projectTask } from "@/lib/routes";
import type { BusinessRule } from "@/lib/business-rules";
import type { GrillMessage, GrillResult } from "@/lib/ai/grill";

const PRIORITY_DOT_COLOR: Record<TaskPriorityValue, string> = {
  p0: "oklch(0.577 0.245 27.325)",
  p1: "oklch(0.62 0.15 70)",
  p2: "oklch(0.55 0.05 240)",
  p3: "var(--muted-foreground)",
};

type TaskRow = {
  id: string;
  title: string;
  status: TaskStatusValue;
  priority: TaskPriorityValue;
  deadline: string | Date | null;
  readinessScore: number;
  readinessNotes: string;
  businessRules?: BusinessRule[] | unknown;
  assignee?: { name: string } | null;
  dependsOn: { dependency: { id: string; title: string; status: string } }[];
};

type Member = { id: string; name: string; role: string; projectSlug: string };
type ProjectOption = { slug: string; name: string };

type Draft = {
  id: string;
  label: string;
  /** Locked at creation — the task is always created in this project, regardless of what the header switches to later. */
  projectSlug: string;
  projectName: string;
  messages: GrillMessage[];
  pendingQuestion: string | null;
  pendingChoices: string[] | null;
  pendingRecommendation: string | null;
  result: GrillResult | null;
  updatedAt: number;
};

type ComponentDraft = GrillResult["components"][number] & {
  included: boolean;
  assigneeId: string | null;
};

const DRAFTS_KEY = "introverthubs.grillDrafts";

function loadDrafts(): Draft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DRAFTS_KEY);
    return raw ? (JSON.parse(raw) as Draft[]) : [];
  } catch {
    return [];
  }
}

function saveDrafts(drafts: Draft[]) {
  window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

function asRules(raw: unknown): BusinessRule[] {
  return Array.isArray(raw) ? (raw as BusinessRule[]) : [];
}

/** Wrapped so lint's render-purity check doesn't flag Date.now() calls inside event handlers. */
function nowMs(): number {
  return Date.now();
}

function newDraft(project: ProjectOption): Draft {
  return {
    id: crypto.randomUUID(),
    label: "New requirement",
    projectSlug: project.slug,
    projectName: project.name,
    messages: [],
    pendingQuestion: null,
    pendingChoices: null,
    pendingRecommendation: null,
    result: null,
    updatedAt: nowMs(),
  };
}

export function TasksBoard({
  initialTasks,
  members,
  projects,
  currentProjectSlug,
}: {
  initialTasks: TaskRow[];
  members: Member[];
  projects: ProjectOption[];
  currentProjectSlug: string;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftFilter, setDraftFilter] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newChatProjectSlug, setNewChatProjectSlug] = useState(currentProjectSlug);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [components, setComponents] = useState<ComponentDraft[]>([]);
  const [creating, setCreating] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "board">("list");
  const [statusFilter, setStatusFilter] = useState<TaskStatusValue | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const currentProject = projects.find((p) => p.slug === currentProjectSlug) ?? {
    slug: currentProjectSlug,
    name: currentProjectSlug,
  };

  const visibleDrafts = useMemo(
    () => (draftFilter === "all" ? drafts : drafts.filter((d) => d.projectSlug === draftFilter)),
    [drafts, draftFilter],
  );

  const sorted = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority.localeCompare(b.priority);
        return b.readinessScore - a.readinessScore;
      }),
    [tasks],
  );

  const assigneeOptions = useMemo(
    () => Array.from(new Set(sorted.map((t) => t.assignee?.name).filter((n): n is string => !!n))),
    [sorted],
  );

  const filtered = useMemo(
    () =>
      sorted.filter(
        (t) =>
          (statusFilter === "all" || t.status === statusFilter) &&
          (assigneeFilter === "all" || t.assignee?.name === assigneeFilter),
      ),
    [sorted, statusFilter, assigneeFilter],
  );

  const blockedCount = sorted.filter((t) => t.status === "blocked").length;

  async function refresh() {
    const res = await fetch(`/api/tasks?project=${encodeURIComponent(currentProjectSlug)}`);
    const data = await res.json();
    if (res.ok) setTasks(data.tasks);
    router.refresh();
  }

  function persist(next: Draft) {
    const list = loadDrafts().filter((d) => d.id !== next.id);
    list.unshift(next);
    saveDrafts(list);
    setDrafts(list);
    setDraft(next);
  }

  function discardDraft(id: string) {
    const list = loadDrafts().filter((d) => d.id !== id);
    saveDrafts(list);
    setDrafts(list);
    if (draft?.id === id) {
      setDraft(null);
      setComponents([]);
    }
  }

  function openDraft(d: Draft) {
    setDraft(d);
    setError(null);
    if (d.result) {
      setComponents(
        d.result.components.map((c) => ({ ...c, included: true, assigneeId: null })),
      );
    } else {
      setComponents([]);
    }
  }

  async function submitAnswer(forceFinish = false, override?: string) {
    if (!draft) return;
    const text = (override ?? answer).trim();
    if (!forceFinish && !text) return;
    setError(null);
    setLoading(true);
    const withPendingQuestion: GrillMessage[] = draft.pendingQuestion
      ? [...draft.messages, { role: "assistant", content: draft.pendingQuestion }]
      : draft.messages;
    // Force-finish with nothing typed: don't send an empty user message —
    // the forceFinish flag alone tells the API to wrap up with what it has.
    const messages: GrillMessage[] = text
      ? [...withPendingQuestion, { role: "user", content: text }]
      : withPendingQuestion;
    if (messages.length === 0) {
      setLoading(false);
      return;
    }

    const res = await fetch("/api/tasks/grill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, forceFinish, projectSlug: draft.projectSlug }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return;
    }
    setAnswer("");
    const label = messages[0]?.content.slice(0, 60) || draft.label;
    if (data.done) {
      const result = data.result as GrillResult;
      persist({
        ...draft,
        label,
        messages,
        pendingQuestion: null,
        pendingChoices: null,
        pendingRecommendation: null,
        result,
        updatedAt: nowMs(),
      });
      setComponents(result.components.map((c) => ({ ...c, included: true, assigneeId: null })));
    } else {
      persist({
        ...draft,
        label,
        messages,
        pendingQuestion: data.question as string,
        pendingChoices: (data.choices as string[] | undefined) ?? null,
        pendingRecommendation: (data.recommendation as string | undefined) ?? null,
        result: null,
        updatedAt: nowMs(),
      });
    }
  }

  async function createTask() {
    if (!draft?.result) return;
    setCreating(true);
    setError(null);
    const transcript = draft.messages
      .map((m) => `${m.role === "user" ? "PM" : "AI"}: ${m.content}`)
      .join("\n\n");
    const res = await fetch("/api/tasks/grill-finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleHint: draft.result.titleHint,
        requirement: draft.result.requirement,
        acceptanceCriteria: draft.result.acceptanceCriteria,
        businessRules: draft.result.businessRules,
        components: components
          .filter((c) => c.included)
          .map((c) => ({
            component: c.component,
            title: c.title,
            description: c.description,
            assigneeId: c.assigneeId,
          })),
        transcript,
        projectSlug: draft.projectSlug,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return;
    }
    discardDraft(draft.id);
    setOpen(false);
    await refresh();
  }

  async function runContext(id: string) {
    setRunningId(id);
    setError(null);
    const res = await fetch(`/api/tasks/${id}/context`, { method: "POST" });
    const data = await res.json();
    setRunningId(null);
    if (!res.ok) {
      setError(data.error ?? "Context run failed");
      return;
    }
    await refresh();
  }

  async function startWorking(id: string) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "working" }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to start work");
      return;
    }
    await refresh();
  }

  const recommendation = resolveRecommendation(
    draft?.pendingChoices ?? null,
    draft?.pendingRecommendation ?? null,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight">Tasks</h1>
        <div className="flex items-center gap-2.5">
          <Select value={assigneeFilter} onValueChange={(v) => v && setAssigneeFilter(v)}>
            <SelectTrigger className="h-8 rounded-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Assignee: All</SelectItem>
              {assigneeOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="inline-flex overflow-hidden rounded-lg ring-1 ring-border">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`px-3.5 py-1.5 text-xs font-medium ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setView("board")}
              className={`px-3.5 py-1.5 text-xs font-medium ${view === "board" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Board
            </button>
          </div>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (v) {
              setDrafts(loadDrafts());
              setNewChatProjectSlug(currentProjectSlug);
            } else {
              setDraft(null);
              setComponents([]);
              setAnswer("");
              setError(null);
            }
          }}
        >
          <DialogTrigger render={<Button />}>New from intent</DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {draft ? `${draft.label} — ${draft.projectName}` : "Dynamic requirement"}
              </DialogTitle>
            </DialogHeader>

            {!draft ? (
              <div className="space-y-3">
                {drafts.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>คุยค้างไว้</Label>
                      <Select value={draftFilter} onValueChange={(v) => v && setDraftFilter(v)}>
                        <SelectTrigger className="h-7 w-auto text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">ทุก project</SelectItem>
                          {projects.map((p) => (
                            <SelectItem key={p.slug} value={p.slug}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {visibleDrafts.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-black/10 bg-slate-50 p-2 text-sm"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left hover:underline"
                          onClick={() => openDraft(d)}
                        >
                          <span className="text-slate-400">[{d.projectName}]</span> {d.label}
                          {d.result ? " · พร้อมสร้าง" : ""}
                        </button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => discardDraft(d.id)}
                        >
                          ลบ
                        </Button>
                      </div>
                    ))}
                    {visibleDrafts.length === 0 ? (
                      <p className="text-xs text-slate-500">ไม่มีบทสนทนาค้างไว้ใน project นี้</p>
                    ) : null}
                  </div>
                ) : null}
                <div className="space-y-2 rounded-lg border border-black/10 p-2">
                  <Label className="text-xs">Project</Label>
                  <Select value={newChatProjectSlug} onValueChange={(v) => v && setNewChatProjectSlug(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.slug} value={p.slug}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full"
                    onClick={() =>
                      openDraft(
                        newDraft(
                          projects.find((p) => p.slug === newChatProjectSlug) ?? currentProject,
                        ),
                      )
                    }
                  >
                    เริ่มคุยใหม่
                  </Button>
                </div>
              </div>
            ) : draft.result ? (
              <div className="space-y-4">
                <div className="rounded-[14px] bg-card p-4 ring-1 ring-foreground/[0.08]">
                  <div className="text-sm font-semibold">{draft.result.titleHint}</div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    {draft.result.requirement}
                  </p>
                  {draft.result.acceptanceCriteria ? (
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                      AC: {draft.result.acceptanceCriteria}
                    </p>
                  ) : null}
                  {draft.result.businessRules.length ? (
                    <div className="mt-1">
                      {draft.result.businessRules.map((r, i) => (
                        <div
                          key={r.key}
                          className={`flex justify-between gap-2 py-1.5 text-[13px] ${i > 0 ? "border-t border-border" : ""}`}
                        >
                          <span className="text-muted-foreground">{r.label}</span>
                          <span className="font-medium">
                            {r.value}
                            {r.unit ? ` ${r.unit}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2.5">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Sub-tasks per component
                  </p>
                  {components.length === 0 ? (
                    <p className="text-xs text-muted-foreground">ไม่มี component ที่เกี่ยวข้อง</p>
                  ) : null}
                  {components.map((c, i) => (
                    <div
                      key={`${c.component}-${i}`}
                      className="rounded-xl border border-border p-3"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <label className="flex items-center gap-2 text-[13px] font-medium">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-border"
                            checked={c.included}
                            onChange={(e) =>
                              setComponents((prev) =>
                                prev.map((p, pi) =>
                                  pi === i ? { ...p, included: e.target.checked } : p,
                                ),
                              )
                            }
                          />
                          <Badge variant="secondary" className="font-normal">
                            {TASK_COMPONENT_LABEL[c.component]}
                          </Badge>
                          <span className={c.included ? "" : "text-muted-foreground"}>{c.title}</span>
                        </label>
                      </div>
                      {c.included ? (
                        <>
                          <p className="mb-2 pl-6 text-xs text-muted-foreground">{c.description}</p>
                          <div className="pl-6">
                            <Select
                              value={c.assigneeId ?? undefined}
                              onValueChange={(value) =>
                                setComponents((prev) =>
                                  prev.map((p, pi) =>
                                    pi === i ? { ...p, assigneeId: value || null } : p,
                                  ),
                                )
                              }
                            >
                              <SelectTrigger className="max-w-[220px]">
                                <SelectValue placeholder="Assign to…" />
                              </SelectTrigger>
                              <SelectContent>
                                {members
                                  .filter(
                                    (m) =>
                                      m.projectSlug === draft.projectSlug &&
                                      m.role === COMPONENT_TO_ROLE[c.component],
                                  )
                                  .map((m) => (
                                    <SelectItem key={m.id} value={m.id}>
                                      {m.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2.5">
                  <Button variant="outline" className="flex-1" onClick={() => setDraft(null)}>
                    ย้อนกลับ
                  </Button>
                  <Button className="flex-1" disabled={creating} onClick={createTask}>
                    {creating ? "กำลังสร้าง…" : "สร้าง Task"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col gap-3">
                  {draft.messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={
                          m.role === "user"
                            ? "max-w-[78%] rounded-2xl rounded-br-[4px] bg-primary px-3.5 py-2.5 text-[13px] leading-relaxed text-primary-foreground"
                            : "max-w-[78%] rounded-2xl rounded-bl-[4px] bg-card px-3.5 py-2.5 text-[13px] leading-relaxed ring-1 ring-foreground/[0.08]"
                        }
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {draft.pendingQuestion ? (
                    <div className="flex justify-start">
                      <div className="max-w-[78%] rounded-2xl rounded-bl-[4px] bg-card px-3.5 py-2.5 text-[13px] leading-relaxed ring-1 ring-foreground/[0.08]">
                        {draft.pendingQuestion}
                      </div>
                    </div>
                  ) : null}
                  {recommendation.hintText ? (
                    <div className="px-1 text-xs text-muted-foreground">
                      💡 แนะนำ: {recommendation.hintText}
                    </div>
                  ) : null}
                </div>
                {draft.pendingChoices?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {draft.pendingChoices.map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        disabled={loading}
                        onClick={() => submitAnswer(false, choice)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs disabled:opacity-50"
                      >
                        {choice}
                        {choice === recommendation.matchedChoice ? (
                          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                            แนะนำ
                          </Badge>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
                <Textarea
                  rows={3}
                  className="rounded-[14px]"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={
                    draft.messages.length === 0
                      ? "อยากได้ feature อะไร?"
                      : "พิมพ์คำตอบ…"
                  }
                />
                <div className="flex gap-2.5">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={loading}
                    onClick={() => submitAnswer(true)}
                  >
                    พอแล้ว สรุปเลย
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={loading || !answer.trim()}
                    onClick={() => submitAnswer(false)}
                  >
                    {loading ? "…" : "ส่ง"}
                  </Button>
                </div>
              </div>
            )}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </DialogContent>
        </Dialog>
      </div>

      {error && !open ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`rounded-full border px-2.5 py-1 text-xs ${
            statusFilter === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground"
          }`}
        >
          All ({sorted.length})
        </button>
        {blockedCount > 0 ? (
          <button
            type="button"
            onClick={() => setStatusFilter((f) => (f === "blocked" ? "all" : "blocked"))}
            className="rounded-full border px-2.5 py-1 text-xs font-medium"
            style={
              statusFilter === "blocked"
                ? { backgroundColor: "var(--st-blocked)", color: "white", borderColor: "var(--st-blocked)" }
                : { color: "var(--st-blocked)", borderColor: "oklch(0.577 0.245 27.325 / 0.3)", backgroundColor: "var(--st-blocked-bg)" }
            }
          >
            🚧 Blocked ({blockedCount})
          </button>
        ) : null}
      </div>

      {view === "board" ? (
        <div className="flex gap-3.5 overflow-x-auto pb-2">
          {TASK_STATUSES.map((s) => {
            const columnTasks = filtered.filter((t) => t.status === s);
            const { color } = taskStatusStyle(s);
            return (
              <div key={s} className="w-[232px] flex-none">
                <div className="mb-2.5 flex items-center gap-2 px-1">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs font-semibold tracking-wide text-foreground uppercase">
                    {TASK_STATUS_LABEL[s]}
                  </span>
                  <span className="ml-auto text-[11px] text-muted-foreground">{columnTasks.length}</span>
                </div>
                <div
                  className={`flex flex-col gap-2 ${s === "blocked" ? "-mx-1.5 rounded-lg p-1.5" : ""}`}
                  style={s === "blocked" ? { backgroundColor: "var(--st-blocked-bg)" } : undefined}
                >
                  {columnTasks.map((t) => (
                    <Link
                      key={t.id}
                      href={projectTask(currentProjectSlug, t.id)}
                      className="block rounded-[10px] bg-card px-3 py-2.5 ring-1 ring-foreground/[0.07]"
                    >
                      {t.dependsOn.length > 0 ? (
                        <span
                          className="mb-1.5 inline-flex h-[17px] items-center rounded-full px-1.5 text-[10px] font-medium"
                          style={{ backgroundColor: "oklch(0.52 0.14 300 / 0.1)", color: "oklch(0.46 0.14 300)" }}
                        >
                          🔍 part of {t.dependsOn.length} sub-tasks
                        </span>
                      ) : null}
                      <p className="mb-2 text-[12.5px] font-medium leading-snug">{t.title}</p>
                      <div className="flex items-center gap-2">
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: PRIORITY_DOT_COLOR[t.priority] }}
                        />
                        <span className="text-[11px] text-muted-foreground">
                          {t.deadline ? new Date(t.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                        </span>
                        <span className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                          {t.assignee?.name?.[0]?.toUpperCase() ?? "?"}
                        </span>
                      </div>
                      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground"
                          style={{ width: `${t.readinessScore}%` }}
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
      <div className="overflow-hidden rounded-xl border border-black/5 bg-white/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Rules</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Readiness</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => {
              const rules = asRules(t.businessRules);
              return (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link href={projectTask(currentProjectSlug, t.id)} className="font-medium hover:underline">
                      {t.title}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: PRIORITY_DOT_COLOR[t.priority] }}
                      />
                      {TASK_PRIORITY_LABEL[t.priority]}
                    </div>
                    {t.dependsOn.length > 0 ? (
                      <span
                        className="mt-1 inline-flex h-[18px] items-center rounded-full px-1.5 text-[10.5px] font-medium"
                        style={{ backgroundColor: "oklch(0.52 0.14 300 / 0.1)", color: "oklch(0.46 0.14 300)" }}
                      >
                        🔍 part of {t.dependsOn.length} sub-tasks
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.assignee?.name ?? <span className="text-slate-400">Unassigned</span>}
                  </TableCell>
                  <TableCell className="max-w-[200px] text-xs text-slate-600">
                    {rules.length
                      ? rules.map((r) => `${r.label}: ${r.value}`).join(" · ")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <TaskStatusBadge status={t.status} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{t.readinessScore}</div>
                    <div className="max-w-[160px] truncate text-xs text-slate-500">
                      {t.readinessNotes}
                    </div>
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    {t.status === "assigned" || t.status === "ready" ? (
                      <Button size="sm" variant="outline" onClick={() => startWorking(t.id)}>
                        Start working
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={runningId === t.id}
                      onClick={() => runContext(t.id)}
                    >
                      {runningId === t.id ? "Running…" : "Run context"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-slate-500">
                  Paste a free-form intent — IntrovertHubs builds BusinessRules[] dynamically.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      )}
    </div>
  );
}
