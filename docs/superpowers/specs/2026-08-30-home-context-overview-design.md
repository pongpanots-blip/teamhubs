# Home Page: Context Overview

Date: 2026-08-30
Status: Approved

## Problem

The current `/app` home page (`src/app/app/page.tsx`) shows a generic stat-card
grid (Tasks, Ready/Assigned, Working, Doc chunks, Context runs). It answers
"how many things exist" but not "what do I need to act on right now" or "who
is blocked." Per the product brief, the home page should be built around
context — what the user owns, what the team is doing, and what needs
attention — not a dashboard of counters.

## Goals

- Replace the stat-card home page with three sections: **My Work**, **Team**,
  **Attention**, matching the approved wireframe.
- Surface actionable state (blocked, ready-for-dev, missing context) instead
  of raw counts.
- Respect role: most roles see only their own work; PM sees everything.

## Non-goals

- No changes to the Tasks board, task detail page, or task data model.
- No new task actions (start working / run context) on the home page itself —
  those already exist on `/app/tasks` and the task detail page.

## Data fetching

Server component (`src/app/app/page.tsx`) does one query pass and passes data
down to presentational components:

- `session` (current user) and `membership` (role, team) — already fetched
  today for the redirect/onboarding checks.
- All team `Task` rows with `assignee` and `dependsOn` included (single query,
  reused across all three sections — no per-section refetching).
- All `Membership` rows for the team with `user` included, for the Team
  section.

## Sections

### 1. My Work

- **Scope by role**: for role `pm`, show every task belonging to the team
  (not filtered by assignee). For roles `dev` and `ui`, show only tasks where
  `assigneeId === session.user.id`.
- **Filter**: client-side status tabs — All / Active / Done.
  - Active = `status IN (ready, assigned, working, blocked, review)`
  - Done = `status === done`
  - All = no filter (includes `not_ready` too)
- **Row rendering**: status dot + title + status label, linking to
  `/app/tasks/[id]`.
  - 🔴 `blocked`
  - 🟢 `working`
  - 🟡 `ready` or `assigned`
  - ⚪ `not_ready`
  - ✅ `done`
  - 🔵 `review`
- Default tab on load: Active.

### 2. Team

- One row per `Membership`: member name + role badge (`pm`/`ui`/`dev`).
- "Current task" shown per member = their most relevant **active** task
  (same Active definition as My Work), chosen by:
  1. Lowest priority value first (`p0` before `p1` before `p2` before `p3`)
  2. Then earliest `deadline` (nulls last)
- If the member has more than one active task, append `+N more` (N = active
  count − 1).
- If the member has zero active tasks, show "No active task" in muted text.
- Row is not a link (no single task to route to when there are multiple);
  the shown task title links to its detail page when there's exactly one.

### 3. Attention

Three counts, each rendered as a link into `/app/tasks` with a query param
the tasks page can read to pre-filter (e.g. `?attention=missing_context`,
`?attention=blocked`, `?attention=ui_ready`). Wiring the actual filter
behavior on `/app/tasks` is out of scope for this change — the links just
need to be present and correctly counted; filtering there can follow in a
separate pass if `/app/tasks` doesn't already support these query params.

- **⚠ Missing Context**: count of tasks where
  `readinessScore < 50 OR !requirementPresent OR !rulesPresent OR !acPresent`.
- **🚧 Blocked**: count of tasks where `status === "blocked"`.
- **🎨 UI Ready for Dev**: count of tasks where `figmaReady === true AND
  status IN (not_ready, ready)`.

Counts are computed across the whole team (not scoped by role) — Attention is
a team-wide signal regardless of who's viewing.

## Components

New directory `src/components/home/`:

- `my-work-section.tsx` — client component (owns the tab state).
- `team-section.tsx` — server-renderable presentational component.
- `attention-section.tsx` — server-renderable presentational component.

`src/app/app/page.tsx` fetches all data and composes the three sections
inside the existing `AppShell`. The old stat-card grid is removed entirely.

## Testing

- Unit-level: pure functions for "pick most relevant active task" and
  "compute attention counts" should be extracted (e.g. into
  `src/lib/home.ts`) so they're testable without rendering.
- Manual: verify in-browser for a PM account (sees all tasks in My Work) and
  a dev/ui account (sees only their own), with at least one blocked task, one
  figma-ready task, and one low-readiness task seeded to confirm counts.
