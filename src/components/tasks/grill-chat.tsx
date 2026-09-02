"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { resolveRecommendation } from "@/lib/ai/grill-recommendation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_COMPONENT_LABEL, COMPONENT_TO_ROLE } from "@/lib/task-constants";
import { projectTasks } from "@/lib/routes";
import type { GrillMessage, GrillResult } from "@/lib/ai/grill";

type Member = { id: string; name: string; role: string; projectSlug: string; activeTaskCount: number };
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

/**
 * Drafts live in localStorage, which React can't read during render. Cache the
 * parsed list so useSyncExternalStore gets a stable snapshot, and bump it only
 * when we write (or another tab does).
 */
let draftsSnapshot: Draft[] = [];
let draftsRaw: string | null = null;
const draftListeners = new Set<() => void>();
const EMPTY_DRAFTS: Draft[] = [];

function draftsSubscribe(listener: () => void) {
  draftListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    draftListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function draftsSnapshotOf(): Draft[] {
  const raw = window.localStorage.getItem(DRAFTS_KEY);
  if (raw !== draftsRaw) {
    draftsRaw = raw;
    draftsSnapshot = loadDrafts();
  }
  return draftsSnapshot;
}

function saveDrafts(drafts: Draft[]) {
  window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  draftsRaw = null;
  for (const listener of draftListeners) listener();
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

export function GrillChat({
  members,
  projects,
  currentProjectSlug,
}: {
  members: Member[];
  projects: ProjectOption[];
  currentProjectSlug: string;
}) {
  const router = useRouter();
  const drafts = useSyncExternalStore(
    draftsSubscribe,
    draftsSnapshotOf,
    useCallback(() => EMPTY_DRAFTS, []),
  );
  const [draftFilter, setDraftFilter] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [components, setComponents] = useState<ComponentDraft[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentProject = projects.find((p) => p.slug === currentProjectSlug) ?? {
    slug: currentProjectSlug,
    name: currentProjectSlug,
  };

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const isChatting = !!draft && !draft.result;

  // Keep the newest bubble (and the typing indicator) in view as the thread grows.
  // Waits a frame so the just-mounted bubble is laid out before we measure, and
  // scrolls smoothly so the PM sees where the thread moved.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [draft?.messages.length, draft?.pendingQuestion, draft?.pendingChoices, loading]);

  useEffect(() => {
    if (isChatting) composerRef.current?.focus();
  }, [isChatting, draft?.id]);

  const visibleDrafts = useMemo(
    () => (draftFilter === "all" ? drafts : drafts.filter((d) => d.projectSlug === draftFilter)),
    [drafts, draftFilter],
  );

  function persist(next: Draft) {
    const list = loadDrafts().filter((d) => d.id !== next.id);
    list.unshift(next);
    saveDrafts(list);
    setDraft(next);
  }

  function discardDraft(id: string) {
    const list = loadDrafts().filter((d) => d.id !== id);
    saveDrafts(list);
    if (draft?.id === id) {
      setDraft(null);
      setComponents([]);
    }
  }

  function openDraft(d: Draft) {
    setDraft(d);
    setError(null);
    setAnswer("");
    setComponents(
      d.result ? d.result.components.map((c) => ({ ...c, included: true, assigneeId: null })) : [],
    );
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

    // Show the PM's answer on the right straight away — tapping a choice should
    // land in the transcript like a typed message, not appear only once the
    // model replies.
    persist({
      ...draft,
      messages,
      pendingQuestion: null,
      pendingChoices: null,
      pendingRecommendation: null,
      updatedAt: nowMs(),
    });
    setAnswer("");

    const res = await fetch("/api/tasks/grill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, forceFinish, projectSlug: draft.projectSlug }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      // Put the question back so the PM can retry the same answer.
      persist({ ...draft, updatedAt: nowMs() });
      setAnswer(text);
      setError(data.error ?? "Failed");
      return;
    }
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
        priority: draft.result.priority,
        deadline: draft.result.deadline || null,
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
    router.push(projectTasks(draft.projectSlug));
    router.refresh();
  }

  const recommendation = resolveRecommendation(
    draft?.pendingChoices ?? null,
    draft?.pendingRecommendation ?? null,
  );

  const heading = draft?.result ? "Ready to create" : "New task from intent";
  const subtitle = draft?.result
    ? "Reviewed from the conversation — adjust sub-tasks and assignees before creating."
    : "AI grills the PM one question at a time, then splits the work by component.";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-none pb-4">
        <div className="mx-auto flex w-full max-w-[680px] items-start justify-between gap-4">
          <div>
            <h1 className="text-title font-semibold tracking-tight">{heading}</h1>
            <p className="mt-1 text-body text-muted-foreground">{subtitle}</p>
          </div>
          {draft ? (
            <span className="inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium">
              <span className="font-normal text-muted-foreground">Project</span>
              {draft.projectName}
            </span>
          ) : null}
        </div>
      </div>

      {!draft ? (
        <div className="mx-auto w-full max-w-[680px] space-y-3 pb-2">
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
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-2 text-sm"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left hover:underline"
                    onClick={() => openDraft(d)}
                  >
                    <span className="text-muted-foreground">[{d.projectName}]</span> {d.label}
                    {d.result ? " · พร้อมสร้าง" : ""}
                  </button>
                  <Button size="sm" variant="outline" onClick={() => discardDraft(d.id)}>
                    ลบ
                  </Button>
                </div>
              ))}
              {visibleDrafts.length === 0 ? (
                <p className="text-xs text-muted-foreground">ไม่มีบทสนทนาค้างไว้ใน project นี้</p>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-2 rounded-xl border border-border bg-card p-3">
            <Button
              className="w-full"
              onClick={() => openDraft(newDraft(currentProject))}
            >
              เริ่มคุยใหม่
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      ) : draft.result ? (
        <div className="mx-auto w-full max-w-[680px] space-y-4 pb-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium" style={{ color: "var(--st-done)" }}>
              ✓ คุยแชท
            </span>
            <span className="h-px w-5 bg-border" />
            <span className="font-semibold text-primary">● มอบหมายคน</span>
            <span className="h-px w-5 bg-border" />
            <span>สร้าง Task</span>
          </div>

          <div
            className="rounded-[14px] p-4"
            style={{ backgroundColor: "var(--violet-bg)", boxShadow: "0 0 0 1px oklch(0.52 0.14 300 / 0.25)" }}
          >
            <div className="text-sm font-semibold">{draft.result.titleHint}</div>
            <p className="mt-1.5 text-body leading-relaxed text-muted-foreground">
              {draft.result.requirement}
            </p>
            {draft.result.acceptanceCriteria ? (
              <p className="mt-1.5 text-body leading-relaxed text-muted-foreground">
                AC: {draft.result.acceptanceCriteria}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-meta">
                {draft.result.priority.toUpperCase()}
              </Badge>
              <Badge variant="secondary" className="text-meta">
                {draft.result.deadline ? `ครบกำหนด ${draft.result.deadline}` : "ไม่มีกำหนดส่ง"}
              </Badge>
            </div>
            {draft.result.businessRules.length ? (
              <div className="mt-1">
                {draft.result.businessRules.map((r, i) => (
                  <div
                    key={r.key}
                    className={`flex justify-between gap-2 py-1.5 text-body ${i > 0 ? "border-t border-border" : ""}`}
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
              <div key={`${c.component}-${i}`} className="rounded-xl border border-border bg-card p-3">
                <div className="mb-2 flex items-center gap-2">
                  <label className="flex items-center gap-2 text-body font-medium">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-border"
                      checked={c.included}
                      onChange={(e) =>
                        setComponents((prev) =>
                          prev.map((p, pi) => (pi === i ? { ...p, included: e.target.checked } : p)),
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
                    <div className="flex flex-wrap gap-1.5 pl-6">
                      {(() => {
                        const candidates = members
                          .filter(
                            (m) =>
                              m.projectSlug === draft.projectSlug &&
                              m.role === COMPONENT_TO_ROLE[c.component],
                          )
                          .sort((a, b) => a.activeTaskCount - b.activeTaskCount);
                        if (candidates.length === 0) {
                          return (
                            <p className="text-xs text-muted-foreground italic">
                              ยังไม่มีคน role &quot;{COMPONENT_TO_ROLE[c.component]}&quot; ในโปรเจกต์นี้ —
                              ปล่อยว่างไว้ก่อนก็สร้างได้
                            </p>
                          );
                        }
                        const suggestedId = candidates[0].id;
                        return candidates.map((m) => {
                          const selected = c.assigneeId === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() =>
                                setComponents((prev) =>
                                  prev.map((p, pi) =>
                                    pi === i
                                      ? { ...p, assigneeId: selected ? null : m.id }
                                      : p,
                                  ),
                                )
                              }
                              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${
                                selected
                                  ? "border-transparent bg-primary text-primary-foreground"
                                  : "border-border bg-card text-foreground hover:bg-muted"
                              }`}
                            >
                              <span
                                className={`flex size-4 items-center justify-center rounded-full text-[9px] font-semibold ${
                                  selected ? "bg-primary-foreground/20" : "bg-muted"
                                }`}
                              >
                                {m.name[0]?.toUpperCase()}
                              </span>
                              {m.name}
                              <span className={selected ? "opacity-80" : "text-muted-foreground"}>
                                · {m.activeTaskCount} งาน active
                              </span>
                              {m.id === suggestedId && !selected ? (
                                <span className="rounded-lg bg-[var(--st-done-bg)] px-1.5 py-px text-[9px] font-semibold text-[color:var(--st-done)]">
                                  แนะนำ
                                </span>
                              ) : null}
                            </button>
                          );
                        });
                      })()}
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
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-[680px] min-h-0 flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto py-2">
            {draft.messages.length === 0 && !draft.pendingQuestion ? (
              <div className="flex justify-start">
                <div className="max-w-[78%] rounded-[14px] rounded-bl-[4px] bg-card px-3.5 py-2.5 text-body leading-relaxed ring-1 ring-foreground/[0.08]">
                  เล่าให้ฟังหน่อยว่าอยากได้ feature อะไร แล้วเดี๋ยวผมซักถามต่อทีละข้อจนได้ requirement ที่ชัดพอจะสร้าง task
                </div>
              </div>
            ) : null}
            {draft.messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[78%] rounded-[14px] rounded-br-[4px] bg-primary px-3.5 py-2.5 text-body leading-relaxed text-primary-foreground"
                      : "max-w-[78%] rounded-[14px] rounded-bl-[4px] bg-card px-3.5 py-2.5 text-body leading-relaxed ring-1 ring-foreground/[0.08]"
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            {draft.pendingQuestion ? (
              <div className="flex justify-start">
                <div className="max-w-[78%] animate-in rounded-[14px] rounded-bl-[4px] bg-card px-3.5 py-2.5 text-body leading-relaxed fade-in slide-in-from-bottom-1 ring-1 duration-300 ring-foreground/[0.08]">
                  {draft.pendingQuestion}
                </div>
              </div>
            ) : null}
            {loading ? (
              <div className="flex justify-start">
                <div className="flex animate-in items-center gap-1 rounded-[14px] rounded-bl-[4px] bg-card px-3.5 py-3 fade-in ring-1 duration-300 ring-foreground/[0.08]">
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </div>
              </div>
            ) : null}
            {recommendation.hintText ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  // Drop the hint into the composer so the PM can tweak it before sending.
                  setAnswer(recommendation.hintText!);
                  composerRef.current?.focus();
                }}
                className="block w-full rounded-[10px] px-1 py-1 text-left text-xs text-muted-foreground hover:bg-card disabled:opacity-50"
              >
                💡 แนะนำ: {recommendation.hintText}{" "}
                <span className="underline">ใช้คำแนะนำนี้</span>
              </button>
            ) : null}
          </div>

          {draft.pendingChoices?.length ? (
            <div className="flex flex-none flex-wrap gap-2 pt-0.5 pb-1">
              {draft.pendingChoices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  disabled={loading}
                  onClick={() => submitAnswer(false, choice)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  {choice}
                  {choice === recommendation.matchedChoice ? (
                    <Badge variant="secondary" className="h-4 px-1.5 text-micro">
                      แนะนำ
                    </Badge>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex-none space-y-2.5 pt-3">
            <Textarea
              ref={composerRef}
              aria-label="Your answer"
              rows={2}
              className="min-h-16 rounded-[14px] bg-card"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter makes a new line — chat convention.
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (!loading && answer.trim()) submitAnswer(false);
                }
              }}
              placeholder={draft.messages.length === 0 ? "อยากได้ feature อะไร?" : "พิมพ์คำตอบ…"}
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
                {loading ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  "ส่ง"
                )}
              </Button>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </div>
      )}
    </div>
  );
}
