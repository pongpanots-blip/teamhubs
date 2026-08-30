# Task Detail Page Redesign

Date: 2026-08-30
Status: Approved

## Problem

The current task detail page (`src/app/app/tasks/[id]/page.tsx`) presents
information as a grid of same-weight cards (Requirement, BusinessRules[],
Links & readiness flags, Decision log, AI advisory, Recent context runs) in
an order that doesn't match how someone actually reads a task: who owns it
and where it stands, then the requirement, then the rules, then what it
depends on, then design/PR/docs, then decisions. Per the approved wireframe,
the page should read top-to-bottom as a single narrative instead of a grid
a reader has to scan.

## Goals

- Reorder the page into the wireframe's single-column sequence: header
  (title/owner/priority/deadline/status) → Readiness bar → Requirement →
  Business Rules → Dependencies → Design → GitHub → Internal Docs →
  Decisions (teaser).
- Keep all existing functionality (AI advisory, recent context runs, full
  decision log with form) — just repositioned below the new sequence,
  unchanged in content and behavior.

## Non-goals

- No changes to the Task data model, queries beyond what's already fetched
  (the existing `include` already has everything needed — see Data below).
- No changes to `RunContextButton` or `DecisionLogForm` behavior.
- No new shared components — this page isn't reused elsewhere, so section
  rendering stays as local helper functions in this file, consistent with
  the existing `Field`/`Flag` helpers already there.

## Data

No new Prisma query needed. The existing `prisma.task.findFirst` include
already covers everything:
- `assignee` → Owner
- `dependsOn.dependency` → Dependencies (title, status; need `.assignee` too
  — **add `assignee: true` to the `dependency` include**, since the current
  query only selects `dependency: true` without nesting the dependency's
  own assignee)
- `decisions` (already ordered `createdAt: desc`) → Decisions teaser is
  `decisions[0]`
- `contextRuns` → unchanged, feeds AI advisory + Recent context runs

## Sections (in order)

### 1. Header

- Title (`task.title`), unchanged styling.
- Key-value rows: Owner (`task.assignee?.name ?? "Unassigned"`), Priority,
  Deadline, Status.
- **Priority**: a new short-label map `TASK_PRIORITY_SHORT_LABEL` (e.g.
  `p0: "Critical"`, `p1: "High"`, `p2: "Medium"`, `p3: "Low"`) added
  alongside the existing `TASK_PRIORITY_LABEL` in `src/lib/task-constants.ts`
  — the existing long form ("P1 High") stays for other UI (tasks table)
  that already uses it.
- **Deadline**: formatted with `date-fns`'s `format(date, "MMM d")` (already
  a dependency) → `"Sep 2"`. `"—"` if null.
- **Status**: existing `TASK_STATUS_LABEL`.

### 2. Readiness

A bar built from two nested `div`s (no new dependency): outer track
(`bg-muted`, fixed height, rounded), inner fill
(`width: {readinessScore}%`, colored). Percentage text
(`{readinessScore}%`) shown next to or below the bar.

### 3. Requirement

`task.requirement` text, using the existing `Field`-style rendering
(whitespace-preserved paragraph, "—" if empty).

### 4. Business Rules

Checklist from `parseBusinessRules(task.businessRules)` (existing helper).
Each line: `✓ {label}: {value}{unit ? " " + unit : ""}`. "No rules
extracted yet." if empty (existing copy, reused).

### 5. Dependencies

Checklist from `task.dependsOn`. Each line: a checkmark or hourglass +
`{dependency.title} — {dependency.assignee?.name ?? "Unassigned"}`.
- ✓ when `dependency.status === "done"`
- ⏳ otherwise
"—" if `task.dependsOn` is empty (existing copy pattern, reused).

### 6. Design

- Label "🎨 Figma".
- Readiness indicator: 🟢 "Ready for Dev" when `task.figmaReady`, otherwise
  ⚪ "Not ready" (mirrors the Attention-section "UI Ready for Dev" language
  from the home page, for consistency).
- "Open Figma" button (existing `Button` component with its `render` prop,
  e.g. `<Button render={<a href={task.figmaUrl} target="_blank"
  rel="noopener noreferrer" />}>Open Figma</Button>`), rendered only when
  `task.figmaUrl` is set. Section itself still renders (with "No Figma
  linked yet.") when there's no URL, so the page doesn't have a hole.

### 7. GitHub

Shown only when `task.githubPrUrl` is set (section omitted entirely
otherwise — no PR is not itself news the way "no Figma yet" is, and this
avoids a permanently-empty header for tasks with no GitHub activity yet).
- Parse PR number from the URL: `/\/pull\/(\d+)/` match on `githubPrUrl`.
  If it matches, render `"PR #{match[1]}"` as a link. If the URL doesn't
  match that pattern (unexpected host/shape), render the raw URL as the
  link text instead of guessing a number.

### 8. Internal Docs

Existing list of `task.internalDocPaths`, unchanged rendering ("—" if
empty).

### 9. Decisions (teaser)

- Shows only `task.decisions[0]?.decision` text (the array is already
  sorted `createdAt: desc`, so `[0]` is the most recent). "No decisions
  yet." if empty.
- The text links (in-page anchor, `href="#decision-log"`) down to the full
  Decision log section (see below), which gets `id="decision-log"` added to
  its `Card`.

## Kept sections, repositioned (unchanged content/behavior)

These stay exactly as they are today — same component, same query fields,
same copy — just moved to appear after the new section stack instead of
interleaved with it:
- **Decision log** (form + full history) — gets `id="decision-log"` added
  for the teaser's anchor link, nothing else changes.
- **AI advisory (Claude) → Engine decisions**
- **Recent context runs**

## Testing

- Manual: open a task with all fields populated (owner, deadline, business
  rules, a done dependency, a not-done dependency, figmaReady + figmaUrl,
  githubPrUrl, internal docs, at least one decision) and confirm every
  section renders the expected value in the expected order.
- Manual: open a task with everything empty/null (no owner, no deadline, no
  rules, no dependencies, no figma, no PR, no docs, no decisions) and
  confirm every section still renders without crashing, using its "—" /
  empty-state copy — in particular confirm the GitHub section is omitted
  entirely (not shown empty) per the Non-goals/section-7 rule above.
- No new pure-logic module is introduced here (unlike the home page), so
  there's no `scripts/check-*.ts` companion for this task — the PR-number
  regex and readiness-bar width are simple enough to verify by reading the
  code and by the manual passes above.
