import { TASK_COMPONENT_LABEL, type TaskComponentValue } from "@/lib/task-constants";
import { parseBusinessRules, type BusinessRule } from "@/lib/business-rules";

/**
 * Per-sub-task handoff doc built straight from a completed grilling session —
 * no extra AI call needed, everything a dev needs is already in the grill
 * result. Written to be self-contained enough to paste into an AI coding
 * assistant and start implementing immediately.
 */
export type GrillHandoffComponent = {
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
    "## Other components in this requirement",
    siblingsToText(input.siblings),
  ].filter((l) => l !== "");

  return { title, content: lines.join("\n") };
}
