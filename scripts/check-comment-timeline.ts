import { mergeTimeline, type CommentEntry, type StatusChangeEntry } from "../src/lib/comments/timeline";

let failures = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : ` — got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
}

function comment(id: string, at: string): CommentEntry {
  return {
    kind: "comment",
    id,
    createdAt: new Date(at),
    authorId: "u1",
    authorName: "Joe",
    body: "hi",
    mentionedIds: [],
    editedAt: null,
  };
}
function status(at: string, to = "working"): StatusChangeEntry {
  return { kind: "status", createdAt: new Date(at), fromStatus: "ready", toStatus: to as never, changedByName: "Joe" };
}

// Empty inputs → empty timeline.
{
  const rows = mergeTimeline([], []);
  assertEqual(rows, [], "no comments and no history yields empty timeline");
}

// Interleaved by time, oldest first.
{
  const rows = mergeTimeline(
    [comment("c1", "2026-01-01T10:00:00Z")],
    [status("2026-01-01T09:00:00Z"), status("2026-01-01T11:00:00Z")],
  );
  assertEqual(
    rows.map((r) => r.kind + "@" + r.createdAt.toISOString()),
    ["status@2026-01-01T09:00:00.000Z", "comment@2026-01-01T10:00:00.000Z", "status@2026-01-01T11:00:00.000Z"],
    "comments and status changes interleave in chronological order",
  );
}

// Only comments, still sorted.
{
  const rows = mergeTimeline(
    [comment("c2", "2026-01-02T00:00:00Z"), comment("c1", "2026-01-01T00:00:00Z")],
    [],
  );
  assertEqual(rows.map((r) => (r as CommentEntry).id), ["c1", "c2"], "comment-only timeline is sorted");
}

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall passed");
