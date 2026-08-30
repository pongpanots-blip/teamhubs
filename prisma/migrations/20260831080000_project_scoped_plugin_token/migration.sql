-- Move the Figma plugin token from Team to Project — the plugin now
-- authenticates as (and is scoped to) a single project, not a whole team.
ALTER TABLE "Project" ADD COLUMN "pluginToken" TEXT;

UPDATE "Project" p SET "pluginToken" = t."pluginToken"
FROM "Team" t
WHERE t."id" = p."teamId" AND t."pluginToken" IS NOT NULL AND p."slug" = 'general';

CREATE UNIQUE INDEX "Project_pluginToken_key" ON "Project"("pluginToken");

DROP INDEX IF EXISTS "Team_pluginToken_key";
ALTER TABLE "Team" DROP COLUMN "pluginToken";
