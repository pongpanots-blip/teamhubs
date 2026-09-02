"use client";

import { useState } from "react";
import { GrillChat } from "@/components/tasks/grill-chat";
import { QuickTaskForm, type QuickTaskMember } from "@/components/tasks/quick-task-form";
import type { SprintOption } from "@/components/tasks/sprint-select";

type Member = { id: string; name: string; role: string; projectSlug: string; activeTaskCount: number };
type ProjectOption = { slug: string; name: string };

/**
 * Two ways into the same page: Grill for scope that still needs pulling out
 * of a PM, a plain form for scope that's already clear. Neither should be
 * buried behind the other — a task not worth grilling shouldn't force
 * someone through a chat first.
 */
export function NewTaskTabs({
  members,
  projects,
  currentProjectSlug,
  sprints,
}: {
  members: Member[];
  projects: ProjectOption[];
  currentProjectSlug: string;
  sprints: SprintOption[];
}) {
  const [mode, setMode] = useState<"grill" | "quick">("grill");

  const quickMembers: QuickTaskMember[] = members
    .filter((m) => m.projectSlug === currentProjectSlug)
    .map((m) => ({ id: m.id, name: m.name }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto mb-3 inline-flex w-fit gap-1 rounded-xl bg-muted p-1">
        <button
          type="button"
          onClick={() => setMode("grill")}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium ${mode === "grill" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
        >
          💬 Grill กับ AI
        </button>
        <button
          type="button"
          onClick={() => setMode("quick")}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium ${mode === "quick" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
        >
          ⚡ กรอกฟอร์มเร็ว
        </button>
      </div>

      {mode === "grill" ? (
        <GrillChat members={members} projects={projects} currentProjectSlug={currentProjectSlug} />
      ) : (
        <div className="mx-auto w-full max-w-[480px] rounded-xl border border-border bg-card p-5">
          <QuickTaskForm projectSlug={currentProjectSlug} sprints={sprints} members={quickMembers} />
        </div>
      )}
    </div>
  );
}
