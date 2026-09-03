-- Human-readable per-project ticket keys (e.g. "CHK-142"): a short uppercase
-- prefix on Project plus a per-project auto-incrementing number on Task.

ALTER TABLE "Project" ADD COLUMN "keyPrefix" TEXT NOT NULL DEFAULT 'TASK';
ALTER TABLE "Project" ADD COLUMN "nextTaskNumber" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Task" ADD COLUMN "taskNumber" INTEGER;

-- Derive each existing project's prefix from its name: letters only, upper,
-- first 4 chars, falling back to "TASK" when the name has no letters at all.
-- Mirrors src/lib/tasks/task-key.ts's deriveKeyPrefix.
UPDATE "Project"
SET "keyPrefix" = COALESCE(
  NULLIF(UPPER(LEFT(REGEXP_REPLACE(UPPER("name"), '[^A-Z]', '', 'g'), 4)), ''),
  'TASK'
);

-- Backfill ticket numbers for existing tasks, ordered by creation within
-- each project, so history reads oldest-first.
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt") AS rn
  FROM "Task"
)
UPDATE "Task" t
SET "taskNumber" = numbered.rn
FROM numbered
WHERE t."id" = numbered."id";

-- Point each project's counter past whatever it just got backfilled to.
WITH maxnum AS (
  SELECT "projectId", MAX("taskNumber") AS max_num
  FROM "Task"
  GROUP BY "projectId"
)
UPDATE "Project" p
SET "nextTaskNumber" = maxnum.max_num + 1
FROM maxnum
WHERE p."id" = maxnum."projectId";

CREATE UNIQUE INDEX "Task_projectId_taskNumber_key" ON "Task"("projectId", "taskNumber");
