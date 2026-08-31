-- Website is its own discipline: a TeamRole a member can hold and a
-- TaskComponent a sub-task can cover, alongside ui / backend / mobile / ai.
ALTER TYPE "TeamRole" ADD VALUE IF NOT EXISTS 'website';
ALTER TYPE "TaskComponent" ADD VALUE IF NOT EXISTS 'website';
