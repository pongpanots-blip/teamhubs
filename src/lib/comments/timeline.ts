import type { TaskStatusValue } from "@/lib/task-constants";

export type CommentEntry = {
  kind: "comment";
  id: string;
  createdAt: Date;
  authorId: string;
  authorName: string;
  body: string;
  mentionedIds: string[];
  editedAt: Date | null;
};

export type StatusChangeEntry = {
  kind: "status";
  createdAt: Date;
  fromStatus: TaskStatusValue | null;
  toStatus: TaskStatusValue;
  changedByName: string | null;
};

export type TimelineEntry = CommentEntry | StatusChangeEntry;

/** Combines comments and status-history rows into one chronological (oldest-first) timeline. */
export function mergeTimeline(
  comments: CommentEntry[],
  statusChanges: StatusChangeEntry[],
): TimelineEntry[] {
  return [...comments, ...statusChanges].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
}
