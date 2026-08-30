"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  type TaskPriorityValue,
  type TaskStatusValue,
  TASK_STATUS_LABEL,
} from "@/lib/task-constants";
import type { BusinessRule } from "@/lib/business-rules";
import type { GrillMessage, GrillResult } from "@/lib/ai/grill";

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

type Member = { id: string; name: string; role: string };

type Draft = {
  id: string;
  label: string;
  messages: GrillMessage[];
  pendingQuestion: string | null;
  result: GrillResult | null;
  updatedAt: number;
};

type ComponentDraft = GrillResult["components"][number] & {
  included: boolean;
  assigneeId: string | null;
};

const DRAFTS_KEY = "teamhub.grillDrafts";

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

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  not_ready: "secondary",
  ready: "default",
  assigned: "outline",
  working: "default",
  blocked: "destructive",
  review: "outline",
  done: "secondary",
};

function asRules(raw: unknown): BusinessRule[] {
  return Array.isArray(raw) ? (raw as BusinessRule[]) : [];
}

function newDraft(): Draft {
  return {
    id: crypto.randomUUID(),
    label: "New requirement",
    messages: [],
    pendingQuestion: null,
    result: null,
    updatedAt: Date.now(),
  };
}

export function TasksBoard({
  initialTasks,
  members,
}: {
  initialTasks: TaskRow[];
  members: Member[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [components, setComponents] = useState<ComponentDraft[]>([]);
  const [creating, setCreating] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority.localeCompare(b.priority);
        return b.readinessScore - a.readinessScore;
      }),
    [tasks],
  );

  async function refresh() {
    const res = await fetch("/api/tasks");
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

  async function submitAnswer(forceFinish = false) {
    if (!draft) return;
    if (!forceFinish && !answer.trim()) return;
    setError(null);
    setLoading(true);
    const messages: GrillMessage[] = draft.pendingQuestion
      ? [
          ...draft.messages,
          { role: "assistant", content: draft.pendingQuestion },
          { role: "user", content: answer.trim() },
        ]
      : draft.messages.length
        ? [...draft.messages, { role: "user", content: answer.trim() }]
        : [{ role: "user", content: answer.trim() }];

    const res = await fetch("/api/tasks/grill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, forceFinish }),
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
      persist({ ...draft, label, messages, pendingQuestion: null, result, updatedAt: Date.now() });
      setComponents(result.components.map((c) => ({ ...c, included: true, assigneeId: null })));
    } else {
      persist({
        ...draft,
        label,
        messages,
        pendingQuestion: data.question as string,
        result: null,
        updatedAt: Date.now(),
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-600">
            AI grills the PM one question at a time, then splits the work by component.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (v) {
              setDrafts(loadDrafts());
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
              <DialogTitle>{draft ? draft.label : "Dynamic requirement"}</DialogTitle>
            </DialogHeader>

            {!draft ? (
              <div className="space-y-3">
                {drafts.length > 0 ? (
                  <div className="space-y-2">
                    <Label>คุยค้างไว้</Label>
                    {drafts.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-black/10 bg-slate-50 p-2 text-sm"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left hover:underline"
                          onClick={() => openDraft(d)}
                        >
                          {d.label}
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
                  </div>
                ) : null}
                <Button className="w-full" onClick={() => openDraft(newDraft())}>
                  เริ่มคุยใหม่
                </Button>
              </div>
            ) : draft.result ? (
              <div className="space-y-4">
                <div className="space-y-1 rounded-lg border border-black/10 bg-slate-50 p-3">
                  <div className="text-sm font-medium">{draft.result.titleHint}</div>
                  <p className="text-xs text-slate-600">{draft.result.requirement}</p>
                  {draft.result.acceptanceCriteria ? (
                    <p className="text-xs text-slate-600">
                      AC: {draft.result.acceptanceCriteria}
                    </p>
                  ) : null}
                  {draft.result.businessRules.length ? (
                    <ul className="space-y-1 text-sm">
                      {draft.result.businessRules.map((r) => (
                        <li key={r.key} className="flex justify-between gap-2">
                          <span className="text-slate-500">{r.label}</span>
                          <span className="font-medium">
                            {r.value}
                            {r.unit ? ` ${r.unit}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>Sub-task ต่อ component</Label>
                  {components.length === 0 ? (
                    <p className="text-xs text-slate-500">ไม่มี component ที่เกี่ยวข้อง</p>
                  ) : null}
                  {components.map((c, i) => (
                    <div
                      key={`${c.component}-${i}`}
                      className="space-y-2 rounded-lg border border-black/10 p-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            checked={c.included}
                            onChange={(e) =>
                              setComponents((prev) =>
                                prev.map((p, pi) =>
                                  pi === i ? { ...p, included: e.target.checked } : p,
                                ),
                              )
                            }
                          />
                          {TASK_COMPONENT_LABEL[c.component]}
                        </label>
                      </div>
                      {c.included ? (
                        <>
                          <p className="text-xs text-slate-600">{c.title}</p>
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
                            <SelectTrigger>
                              <SelectValue placeholder="Assign to…" />
                            </SelectTrigger>
                            <SelectContent>
                              {members
                                .filter((m) => m.role === COMPONENT_TO_ROLE[c.component])
                                .map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
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
                <div className="space-y-1">
                  {draft.messages.map((m, i) => (
                    <div
                      key={i}
                      className={
                        m.role === "user"
                          ? "rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                          : "rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800"
                      }
                    >
                      {m.content}
                    </div>
                  ))}
                  {draft.pendingQuestion ? (
                    <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800">
                      {draft.pendingQuestion}
                    </div>
                  ) : null}
                </div>
                <Textarea
                  rows={3}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={
                    draft.messages.length === 0
                      ? "อยากได้ feature อะไร?"
                      : "พิมพ์คำตอบ…"
                  }
                />
                <div className="flex gap-2">
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
            {sorted.map((t) => {
              const rules = asRules(t.businessRules);
              return (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link href={`/app/tasks/${t.id}`} className="font-medium hover:underline">
                      {t.title}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {TASK_PRIORITY_LABEL[t.priority]}
                    </div>
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
                    <Badge variant={statusVariant[t.status] ?? "secondary"}>
                      {TASK_STATUS_LABEL[t.status]}
                    </Badge>
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
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-slate-500">
                  Paste a free-form intent — TeamHub builds BusinessRules[] dynamically.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
