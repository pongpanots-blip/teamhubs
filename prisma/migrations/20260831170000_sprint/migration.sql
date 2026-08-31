-- Sprints: a fixed time-box a project commits cards into, plus the scope-change
-- log that keeps the burndown honest about work added after kick-off.

CREATE TYPE "ScopeChangeAction" AS ENUM ('added', 'removed');

CREATE TABLE "Sprint" (
  "id"              TEXT NOT NULL,
  "projectId"       TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "goal"            TEXT NOT NULL DEFAULT '',
  "startAt"         TIMESTAMP(3) NOT NULL,
  "endAt"           TIMESTAMP(3) NOT NULL,
  "committedPoints" INTEGER,
  "startedAt"       TIMESTAMP(3),
  "completedAt"     TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Sprint_projectId_startAt_idx" ON "Sprint"("projectId", "startAt");

ALTER TABLE "Sprint"
  ADD CONSTRAINT "Sprint_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SprintScopeChange" (
  "id"        TEXT NOT NULL,
  "sprintId"  TEXT NOT NULL,
  "taskId"    TEXT NOT NULL,
  "action"    "ScopeChangeAction" NOT NULL,
  "points"    INTEGER NOT NULL DEFAULT 0,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SprintScopeChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SprintScopeChange_sprintId_changedAt_idx"
  ON "SprintScopeChange"("sprintId", "changedAt");

ALTER TABLE "SprintScopeChange"
  ADD CONSTRAINT "SprintScopeChange_sprintId_fkey"
  FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SprintScopeChange"
  ADD CONSTRAINT "SprintScopeChange_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A card leaving a sprint keeps the sprint's history intact (the scope-change
-- log still names it), so the link is cleared rather than cascading.
ALTER TABLE "Task" ADD COLUMN "sprintId" TEXT;
ALTER TABLE "Task" ADD COLUMN "storyPoints" INTEGER;

CREATE INDEX "Task_sprintId_idx" ON "Task"("sprintId");

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_sprintId_fkey"
  FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
