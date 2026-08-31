-- Flow metrics foundation: every status transition is logged here, and every
-- card-level metric (cycle time, time in status, WIP age, rework) is derived
-- from this table alone. Append-only — rows are never updated.

CREATE TYPE "StatusCategory" AS ENUM ('backlog', 'active', 'waiting', 'done');

CREATE TABLE "TaskStatusHistory" (
  "id"          TEXT NOT NULL,
  "taskId"      TEXT NOT NULL,
  "fromStatus"  "TaskStatus",
  "toStatus"    "TaskStatus" NOT NULL,
  "category"    "StatusCategory" NOT NULL,
  "changedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changedById" TEXT,

  CONSTRAINT "TaskStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskStatusHistory_taskId_changedAt_idx"
  ON "TaskStatusHistory"("taskId", "changedAt");

ALTER TABLE "TaskStatusHistory"
  ADD CONSTRAINT "TaskStatusHistory_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskStatusHistory"
  ADD CONSTRAINT "TaskStatusHistory_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: existing tasks have no transition log, so metrics would read as
-- "never started". Seed one opening row per task at its creation time carrying
-- its current status. This is deliberately lossy — the path a task actually
-- took is unrecoverable — so anything before this migration shows a single
-- transition and no meaningful cycle time. Real history starts from here.
INSERT INTO "TaskStatusHistory" ("id", "taskId", "fromStatus", "toStatus", "category", "changedAt", "changedById")
SELECT
  'seed_' || t."id",
  t."id",
  NULL,
  t."status",
  CASE t."status"
    WHEN 'working' THEN 'active'::"StatusCategory"
    WHEN 'blocked' THEN 'waiting'::"StatusCategory"
    WHEN 'review'  THEN 'waiting'::"StatusCategory"
    WHEN 'done'    THEN 'done'::"StatusCategory"
    ELSE 'backlog'::"StatusCategory"
  END,
  t."createdAt",
  t."createdById"
FROM "Task" AS t;
