-- AlterTable
ALTER TABLE "Team" ADD COLUMN "pluginToken" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "figmaFile" TEXT,
ADD COLUMN "figmaPage" TEXT,
ADD COLUMN "figmaFrame" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Team_pluginToken_key" ON "Team"("pluginToken");
