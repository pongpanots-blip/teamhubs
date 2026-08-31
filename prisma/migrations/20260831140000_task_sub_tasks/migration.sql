-- Sub-tasks: explicit parent link, replacing "dependency whose component is set".
ALTER TABLE "Task" ADD COLUMN "parentId" TEXT;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");

-- Backfill: grilling sub-tasks were only recognisable as component-carrying
-- dependencies of their parent. Keep the dependency edge (the status engine
-- blocks the parent on it) and record the parenthood explicitly.
UPDATE "Task" AS sub
SET "parentId" = dep."dependentId"
FROM "TaskDependency" AS dep
JOIN "Task" AS parent ON parent."id" = dep."dependentId"
WHERE dep."dependencyId" = sub."id"
  AND sub."component" IS NOT NULL
  AND sub."parentId" IS NULL;
