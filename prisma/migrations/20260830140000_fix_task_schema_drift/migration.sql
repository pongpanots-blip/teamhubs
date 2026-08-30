-- Pre-existing drift fix: schema.prisma had columns/enum values/tables that were
-- never captured by a migration (added directly to schema.prisma without
-- `prisma migrate dev`). This migration brings migration history in line with
-- schema.prisma. Generated via `prisma migrate diff --from-url <dev db> --to-schema-datamodel`.

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('p0', 'p1', 'p2', 'p3');

-- AlterEnum
BEGIN;
CREATE TYPE "TaskStatus_new" AS ENUM ('not_ready', 'ready', 'assigned', 'working', 'blocked', 'review', 'done');
ALTER TABLE "public"."Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status" TYPE "TaskStatus_new" USING ("status"::text::"TaskStatus_new");
ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";
ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";
DROP TYPE "public"."TaskStatus_old";
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'not_ready';
COMMIT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "apiReady" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "businessRules" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "figmaReady" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "internalDocPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'p2',
ADD COLUMN     "requirement" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "requirementPresent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rulesPresent" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "status" SET DEFAULT 'not_ready';

-- CreateTable
CREATE TABLE "DecisionLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "rationale" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DecisionLog_taskId_createdAt_idx" ON "DecisionLog"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "Task_teamId_priority_idx" ON "Task"("teamId", "priority");

-- AddForeignKey
ALTER TABLE "DecisionLog" ADD CONSTRAINT "DecisionLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLog" ADD CONSTRAINT "DecisionLog_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
