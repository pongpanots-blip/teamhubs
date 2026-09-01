-- actualHours stops being a field someone types and becomes a derived one:
-- commit sessions when the card has a merged PR, otherwise capped time in
-- `working`. The two new columns record which of those produced the number and
-- when, so a surprising value can be traced rather than argued about.
-- Existing hand-entered values keep their source NULL until they are recomputed.
ALTER TABLE "Task" ADD COLUMN "actualHoursSource" TEXT;
ALTER TABLE "Task" ADD COLUMN "actualHoursComputedAt" TIMESTAMP(3);
