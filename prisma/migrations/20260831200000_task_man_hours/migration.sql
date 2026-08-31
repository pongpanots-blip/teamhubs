-- Man hours per card: what it was estimated at, and what it actually took.
-- Story points stay as they are — points drive velocity, hours answer capacity.
ALTER TABLE "Task" ADD COLUMN "estimateHours" DOUBLE PRECISION;
ALTER TABLE "Task" ADD COLUMN "actualHours" DOUBLE PRECISION;
