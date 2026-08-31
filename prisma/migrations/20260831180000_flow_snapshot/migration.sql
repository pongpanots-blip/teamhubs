-- Daily board census, so the Cumulative Flow Diagram is a lookup rather than a
-- replay of every transition ever recorded.

CREATE TABLE "FlowSnapshot" (
  "snapshotDate" TIMESTAMP(3) NOT NULL,
  "projectId"    TEXT NOT NULL,
  "status"       "TaskStatus" NOT NULL,
  "taskCount"    INTEGER NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FlowSnapshot_pkey" PRIMARY KEY ("snapshotDate", "projectId", "status")
);

CREATE INDEX "FlowSnapshot_projectId_snapshotDate_idx"
  ON "FlowSnapshot"("projectId", "snapshotDate");

ALTER TABLE "FlowSnapshot"
  ADD CONSTRAINT "FlowSnapshot_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
