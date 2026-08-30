-- CreateEnum
CREATE TYPE "DocSource" AS ENUM ('upload', 'repo');

-- CreateTable
CREATE TABLE "TeamDoc" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "source" "DocSource" NOT NULL DEFAULT 'upload',
    "sizeBytes" INTEGER NOT NULL,
    "indexedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamDoc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamDoc_teamId_idx" ON "TeamDoc"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamDoc_teamId_path_key" ON "TeamDoc"("teamId", "path");

-- AddForeignKey
ALTER TABLE "TeamDoc" ADD CONSTRAINT "TeamDoc_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
