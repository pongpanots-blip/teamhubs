import { prisma } from "@/lib/db";
import { mergeTimeline, type CommentEntry, type StatusChangeEntry } from "@/lib/comments/timeline";
import { TASK_STATUS_LABEL, type TaskStatusValue } from "@/lib/task-constants";
import { CommentForm } from "@/components/tasks/comment-form";
import { CommentRow } from "@/components/tasks/comment-row";
import type { Mentionable } from "@/lib/comments/mentions";

export async function CommentTimeline({
  taskId,
  members,
  currentUserId,
}: {
  taskId: string;
  members: Mentionable[];
  currentUserId: string;
}) {
  const [comments, statusHistory] = await Promise.all([
    prisma.comment.findMany({
      where: { taskId },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.taskStatusHistory.findMany({
      where: { taskId },
      include: { changedBy: { select: { name: true } } },
      orderBy: { changedAt: "asc" },
    }),
  ]);

  const commentEntries: CommentEntry[] = comments.map((c) => ({
    kind: "comment",
    id: c.id,
    createdAt: c.createdAt,
    authorId: c.author.id,
    authorName: c.author.name,
    body: c.body,
    mentionedIds: c.mentionedIds,
    editedAt: c.editedAt,
  }));
  const statusEntries: StatusChangeEntry[] = statusHistory.map((h) => ({
    kind: "status",
    createdAt: h.changedAt,
    fromStatus: h.fromStatus as TaskStatusValue | null,
    toStatus: h.toStatus as TaskStatusValue,
    changedByName: h.changedBy?.name ?? null,
  }));

  const timeline = mergeTimeline(commentEntries, statusEntries);

  return (
    <div className="space-y-4">
      <CommentForm taskId={taskId} members={members} />
      <div className="space-y-2">
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          timeline.map((entry) =>
            entry.kind === "comment" ? (
              <CommentRow
                key={`c-${entry.id}`}
                taskId={taskId}
                entry={entry}
                members={members}
                currentUserId={currentUserId}
              />
            ) : (
              <div
                key={`s-${entry.createdAt.toISOString()}-${entry.toStatus}`}
                className="px-1 text-xs text-muted-foreground"
              >
                {entry.fromStatus ? (
                  <>
                    {TASK_STATUS_LABEL[entry.fromStatus]} → {TASK_STATUS_LABEL[entry.toStatus]}
                  </>
                ) : (
                  <>Created as {TASK_STATUS_LABEL[entry.toStatus]}</>
                )}
                {entry.changedByName ? ` · ${entry.changedByName}` : ""}
                {" · "}
                {entry.createdAt.toISOString()}
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
}
