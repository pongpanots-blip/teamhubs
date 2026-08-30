-- TeamRole: replace "dev" with "backend", add "mobile" and "ai"
CREATE TYPE "TeamRole_new" AS ENUM ('pm', 'ui', 'backend', 'mobile', 'ai');

ALTER TABLE "Membership" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Membership" ALTER COLUMN "role" TYPE "TeamRole_new" USING (
  CASE WHEN "role"::text = 'dev' THEN 'backend' ELSE "role"::text END
)::"TeamRole_new";
ALTER TABLE "Membership" ALTER COLUMN "role" SET DEFAULT 'backend';

ALTER TABLE "Invite" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Invite" ALTER COLUMN "role" TYPE "TeamRole_new" USING (
  CASE WHEN "role"::text = 'dev' THEN 'backend' ELSE "role"::text END
)::"TeamRole_new";
ALTER TABLE "Invite" ALTER COLUMN "role" SET DEFAULT 'backend';

DROP TYPE "TeamRole";
ALTER TYPE "TeamRole_new" RENAME TO "TeamRole";

-- TaskComponent: which part of the system a sub-task covers
CREATE TYPE "TaskComponent" AS ENUM ('ui', 'backend', 'mobile', 'ai');

ALTER TABLE "Task" ADD COLUMN "component" "TaskComponent";
