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
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  type TaskPriorityValue,
  type TaskStatusValue,
} from "@/lib/task-constants";
import type { BusinessRule } from "@/lib/business-rules";

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

export function TasksBoard({ initialTasks }: { initialTasks: TaskRow[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState("");
  const [preview, setPreview] = useState<{
    titleHint: string;
    requirement: string;
    businessRules: BusinessRule[];
  } | null>(null);
  const [extracting, setExtracting] = useState(false);
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

  async function extractPreview() {
    setExtracting(true);
    setError(null);
    const res = await fetch("/api/tasks/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: intent }),
    });
    const data = await res.json();
    setExtracting(false);
    if (!res.ok) {
      setError(data.error ?? "Extract failed");
      return;
    }
    setPreview(data);
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent,
        title: preview?.titleHint,
        requirement: preview?.requirement,
        businessRules: preview?.businessRules,
        internalDocPaths: ["knowledge/requirements.md"],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return;
    }
    setOpen(false);
    setIntent("");
    setPreview(null);
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
            PM types free-form intent → dynamic BusinessRules[]. Assigned ≠ Working.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) {
              setPreview(null);
              setIntent("");
            }
          }}
        >
          <DialogTrigger render={<Button />}>New from intent</DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Dynamic requirement</DialogTitle>
            </DialogHeader>
            <form onSubmit={createTask} className="space-y-3">
              <div className="space-y-2">
                <Label>Describe what you want (no fixed form)</Label>
                <Textarea
                  rows={5}
                  value={intent}
                  onChange={(e) => {
                    setIntent(e.target.value);
                    setPreview(null);
                  }}
                  placeholder="อยากให้ลูกค้าใช้ coupon ลด 10% แต่ใช้ได้ครั้งเดียว และไม่ให้ลดเกิน 500"
                  required
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={!intent.trim() || extracting}
                onClick={extractPreview}
              >
                {extracting ? "Extracting…" : "Extract BusinessRules[]"}
              </Button>
              {preview ? (
                <div className="space-y-2 rounded-lg border border-black/10 bg-slate-50 p-3">
                  <div className="text-sm font-medium">{preview.titleHint}</div>
                  <p className="text-xs text-slate-600">{preview.requirement}</p>
                  <ul className="space-y-1 text-sm">
                    {preview.businessRules.map((r) => (
                      <li key={r.key} className="flex justify-between gap-2">
                        <span className="text-slate-500">{r.label}</span>
                        <span className="font-medium">
                          {r.value}
                          {r.unit ? ` ${r.unit}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Button type="submit" className="w-full" disabled={!intent.trim()}>
                Create task
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

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
