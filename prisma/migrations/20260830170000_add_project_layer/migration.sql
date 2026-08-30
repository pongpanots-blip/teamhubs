-- Project: a distinct project/product under a Team
CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Project_teamId_slug_key" ON "Project"("teamId", "slug");
ALTER TABLE "Project" ADD CONSTRAINT "Project_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ProjectMembership: per-project role
CREATE TABLE "ProjectMembership" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "TeamRole" NOT NULL DEFAULT 'backend',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProjectMembership_projectId_userId_key" ON "ProjectMembership"("projectId", "userId");
CREATE INDEX "ProjectMembership_userId_idx" ON "ProjectMembership"("userId");
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMembership" ADD CONSTRAINT "ProjectMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one default "general" project per existing team.
-- Timestamps use `now() at time zone 'utc'`, not bare `now()` — the columns
-- are `timestamp without time zone` and the app (Prisma/Node) always writes
-- UTC wall-clock into them; a session in a non-UTC timezone (e.g. psql on a
-- machine set to Asia/Bangkok) would otherwise store a skewed value that
-- silently breaks any "oldest project" ordering done later.
INSERT INTO "Project" ("id", "teamId", "name", "slug", "createdAt", "updatedAt")
SELECT 'proj_' || substr(md5(random()::text || t."id"), 1, 20), t."id", t."name", 'general',
  (now() at time zone 'utc'), (now() at time zone 'utc')
FROM "Team" t;

-- Backfill: one ProjectMembership per existing Membership, into that team's default project
INSERT INTO "ProjectMembership" ("id", "projectId", "userId", "role", "createdAt", "updatedAt")
SELECT 'pmem_' || substr(md5(random()::text || m."id"), 1, 20), p."id", m."userId", m."role",
  (now() at time zone 'utc'), (now() at time zone 'utc')
FROM "Membership" m
JOIN "Project" p ON p."teamId" = m."teamId" AND p."slug" = 'general';

-- Task.projectId
ALTER TABLE "Task" ADD COLUMN "projectId" TEXT;
UPDATE "Task" t SET "projectId" = p."id"
FROM "Project" p WHERE p."teamId" = t."teamId" AND p."slug" = 'general';
ALTER TABLE "Task" ALTER COLUMN "projectId" SET NOT NULL;
CREATE INDEX "Task_projectId_status_idx" ON "Task"("projectId", "status");
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TeamDoc.projectId (unique constraint moves from teamId to projectId)
ALTER TABLE "TeamDoc" ADD COLUMN "projectId" TEXT;
UPDATE "TeamDoc" d SET "projectId" = p."id"
FROM "Project" p WHERE p."teamId" = d."teamId" AND p."slug" = 'general';
ALTER TABLE "TeamDoc" ALTER COLUMN "projectId" SET NOT NULL;
DROP INDEX IF EXISTS "TeamDoc_teamId_path_key";
CREATE UNIQUE INDEX "TeamDoc_projectId_path_key" ON "TeamDoc"("projectId", "path");
ALTER TABLE "TeamDoc" ADD CONSTRAINT "TeamDoc_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DocChunk.projectId (unique constraint moves from teamId to projectId)
ALTER TABLE "DocChunk" ADD COLUMN "projectId" TEXT;
UPDATE "DocChunk" c SET "projectId" = p."id"
FROM "Project" p WHERE p."teamId" = c."teamId" AND p."slug" = 'general';
ALTER TABLE "DocChunk" ALTER COLUMN "projectId" SET NOT NULL;
DROP INDEX IF EXISTS "DocChunk_teamId_sourcePath_chunkIndex_key";
CREATE UNIQUE INDEX "DocChunk_projectId_sourcePath_chunkIndex_key" ON "DocChunk"("projectId", "sourcePath", "chunkIndex");
ALTER TABLE "DocChunk" ADD CONSTRAINT "DocChunk_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- IntegrationCredential.projectId (unique constraint moves from teamId to projectId)
ALTER TABLE "IntegrationCredential" ADD COLUMN "projectId" TEXT;
UPDATE "IntegrationCredential" c SET "projectId" = p."id"
FROM "Project" p WHERE p."teamId" = c."teamId" AND p."slug" = 'general';
ALTER TABLE "IntegrationCredential" ALTER COLUMN "projectId" SET NOT NULL;
DROP INDEX IF EXISTS "IntegrationCredential_teamId_provider_key";
CREATE UNIQUE INDEX "IntegrationCredential_projectId_provider_key" ON "IntegrationCredential"("projectId", "provider");
ALTER TABLE "IntegrationCredential" ADD CONSTRAINT "IntegrationCredential_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
