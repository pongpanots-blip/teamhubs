import { TASK_COMPONENT_LABEL, type TaskComponentValue } from "@/lib/task-constants";
import { parseBusinessRules, type BusinessRule } from "@/lib/business-rules";

/**
 * Per-sub-task handoff doc built straight from a completed grilling session —
 * no extra AI call needed, everything a dev needs is already in the grill
 * result. Written to be self-contained enough to paste into an AI coding
 * assistant and start implementing immediately.
 */
export type GrillHandoffComponent = {
  id: string;
  component: TaskComponentValue;
  title: string;
  description: string;
  assigneeName: string | null;
};

export type GrillHandoffInput = {
  parentTitle: string;
  requirement: string;
  businessRules: unknown;
  acceptanceCriteria: string;
  /** The component this doc is for. */
  own: GrillHandoffComponent;
  /** Every other included component, for coordination context. */
  siblings: GrillHandoffComponent[];
};

function rulesToText(rules: BusinessRule[]): string {
  if (rules.length === 0) return "—";
  return rules.map((r) => `- **${r.label}:** ${r.value}${r.unit ? ` ${r.unit}` : ""}`).join("\n");
}

function acceptanceCriteriaToText(ac: string): string {
  const trimmed = ac.trim();
  if (!trimmed) return "—";
  return trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith("-") || line.startsWith("*") ? `- [ ] ${line.slice(1).trim()}` : `- [ ] ${line}`))
    .join("\n");
}

function siblingsToText(siblings: GrillHandoffComponent[]): string {
  if (siblings.length === 0) return "—";
  return siblings
    .map(
      (s) =>
        `- **${TASK_COMPONENT_LABEL[s.component]}** — ${s.title} (${s.assigneeName ?? "Unassigned"})`,
    )
    .join("\n");
}

/**
 * Sub-tasks from the same grill session never block each other (only the
 * parent depends on them) — but a naive reading of the doc still leaves a
 * dev guessing whether they can start now. Spell it out per component pair.
 */
function integrationToText(own: GrillHandoffComponent, siblings: GrillHandoffComponent[]): string {
  if (siblings.length === 0) {
    return "This is the only component for this requirement — no coordination needed.";
  }

  const backend = siblings.find((s) => s.component === "backend");
  const consumers = siblings.filter((s) => s.component === "ui" || s.component === "mobile");
  const lines: string[] = [];

  if (own.component === "backend") {
    if (consumers.length > 0) {
      lines.push(
        `**Expose a clear contract for the frontend.** ${consumers
          .map((c) => `${TASK_COMPONENT_LABEL[c.component]} (${c.assigneeName ?? "unassigned"})`)
          .join(" and ")} will call into what you build here — decide the endpoint(s), request/response shape, and error cases up front, and share that contract with them as early as possible so they can build against it (even before you finish the implementation).`,
      );
    }
    lines.push(
      "**You don't need to wait on anyone.** Nothing else in this requirement blocks you — start now.",
    );
  } else if ((own.component === "ui" || own.component === "mobile") && backend) {
    lines.push(
      `**You don't need to wait for ${TASK_COMPONENT_LABEL["backend"]} to be done.** Start building with mocked/sample data matching the expected response shape now, then swap in the real API once ${backend.assigneeName ?? "the backend dev"} shares the contract for "${backend.title}".`,
    );
  } else {
    lines.push(
      "**You don't need to wait on anyone.** Nothing else in this requirement blocks you — start now.",
    );
  }

  return lines.join("\n\n");
}

function deployChecklistToText(taskId: string): string {
  return [
    `1. Put \`[TASK-${taskId}]\` in your PR title — the system links the merge to this exact sub-task automatically (no need to paste the PR URL anywhere).`,
    `2. Commit a short completion doc to \`docs/handoff/${taskId}.md\` in the same PR — what you built, the API/interface shape, anything the other components need. On merge, it's automatically attached here and forwarded to every sibling sub-task.`,
    `3. Didn't commit it, or need to share before merging? Upload the same .md directly on this task's page instead (Completion doc → Upload) — it forwards the same way, but doesn't change task status.`,
  ].join("\n");
}

export function buildGrillHandoffDoc(input: GrillHandoffInput): { title: string; content: string } {
  const rules = parseBusinessRules(input.businessRules);
  const label = TASK_COMPONENT_LABEL[input.own.component];
  const title = `${input.parentTitle} — ${label}`;

  const lines = [
    `# ${title}`,
    input.own.assigneeName ? `**Assigned to:** ${input.own.assigneeName}` : "",
    "",
    "## Context",
    input.requirement || "—",
    "",
    "## Business rules",
    rulesToText(rules),
    "",
    "## Acceptance criteria",
    acceptanceCriteriaToText(input.acceptanceCriteria),
    "",
    `## Your task — ${label}`,
    `**${input.own.title}**`,
    "",
    input.own.description || "—",
    "",
    "## Can you start now? / How this fits with the rest",
    integrationToText(input.own, input.siblings),
    "",
    "## Other components in this requirement",
    siblingsToText(input.siblings),
    "",
    "## Deploy checklist",
    deployChecklistToText(input.own.id),
  ].filter((l) => l !== "");

  return { title, content: lines.join("\n") };
}
