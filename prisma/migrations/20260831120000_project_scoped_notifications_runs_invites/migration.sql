-- Notification / ContextRun become project-scoped; Invite can grant a project membership.
-- Dev-only DB: rows are backfilled from their task, and any row that cannot be
-- resolved to a project (a notification whose task was deleted) is dropped rather
-- than parked under an arbitrary project.

-- 1) Notification.projectId
ALTER TABLE "Notification" ADD COLUMN "projectId" TEXT;

UPDATE "Notification" n
SET "projectId" = t."projectId"
FROM "Task" t
WHERE n."taskId" = t."id";

-- Task-less notifications (or orphans) have no project to belong to.
DELETE FROM "Notification" WHERE "projectId" IS NULL;

ALTER TABLE "Notification" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Notification_projectId_idx" ON "Notification"("projectId");

-- 2) ContextRun.projectId — always created from a task, so the backfill is total.
ALTER TABLE "ContextRun" ADD COLUMN "projectId" TEXT;

UPDATE "ContextRun" r
SET "projectId" = t."projectId"
FROM "Task" t
WHERE r."taskId" = t."id";

DELETE FROM "ContextRun" WHERE "projectId" IS NULL;

ALTER TABLE "ContextRun" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "ContextRun"
  ADD CONSTRAINT "ContextRun_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ContextRun_projectId_idx" ON "ContextRun"("projectId");

-- 3) Invite gains an optional project grant.
ALTER TABLE "Invite" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Invite" ADD COLUMN "projectRole" "TeamRole";
ALTER TABLE "Invite"
  ADD CONSTRAINT "Invite_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
