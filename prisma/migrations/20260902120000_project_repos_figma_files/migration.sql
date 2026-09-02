-- Registry of the repos/Figma files that belong to a project, independent of
-- any single task's githubPrUrl/figmaUrl — dev/AI needs this to know which
-- repo to check commits/push to before a task ever gets a PR.

CREATE TABLE "ProjectRepository" (
  "id"            TEXT NOT NULL,
  "projectId"     TEXT NOT NULL,
  "provider"      TEXT NOT NULL DEFAULT 'github',
  "owner"         TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "defaultBranch" TEXT NOT NULL DEFAULT 'main',
  "pathPrefix"    TEXT,
  "isPrimary"     BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProjectRepository_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectRepository_projectId_owner_name_pathPrefix_key"
  ON "ProjectRepository"("projectId", "owner", "name", "pathPrefix");

ALTER TABLE "ProjectRepository"
  ADD CONSTRAINT "ProjectRepository_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProjectFigmaFile" (
  "id"        TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "fileKey"   TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProjectFigmaFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectFigmaFile_projectId_fileKey_key"
  ON "ProjectFigmaFile"("projectId", "fileKey");

ALTER TABLE "ProjectFigmaFile"
  ADD CONSTRAINT "ProjectFigmaFile_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
