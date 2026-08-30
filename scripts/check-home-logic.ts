import {
  isOpenStatus,
  pickCurrentTask,
  computeAttentionCounts,
  isMissingContext,
  isUiReadyForDev,
  type HomeTask,
} from "../src/lib/home";

function baseTask(overrides: Partial<HomeTask>): HomeTask {
  return {
    id: "t1",
    title: "Task",
    status: "ready",
    priority: "p2",
    deadline: null,
    assigneeId: null,
    readinessScore: 80,
    requirementPresent: true,
    rulesPresent: true,
    acPresent: true,
    figmaReady: false,
    ...overrides,
  };
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${label}: expected ${e}, got ${a}`);
  }
  console.log(`ok - ${label}`);
}

// isOpenStatus
assertEqual(isOpenStatus("ready"), true, "ready is open");
assertEqual(isOpenStatus("assigned"), true, "assigned is open");
assertEqual(isOpenStatus("working"), true, "working is open");
assertEqual(isOpenStatus("blocked"), true, "blocked is open");
assertEqual(isOpenStatus("review"), true, "review is open");
assertEqual(isOpenStatus("not_ready"), false, "not_ready is not open");
assertEqual(isOpenStatus("done"), false, "done is not open");

// pickCurrentTask: empty
assertEqual(
  pickCurrentTask([]),
  { task: null, extraCount: 0 },
  "pickCurrentTask empty",
);

// pickCurrentTask: excludes non-open statuses
{
  const result = pickCurrentTask([
    baseTask({ id: "done1", status: "done" }),
    baseTask({ id: "notready1", status: "not_ready" }),
  ]);
  assertEqual(result, { task: null, extraCount: 0 }, "pickCurrentTask excludes closed");
}

// pickCurrentTask: picks lowest priority rank first
{
  const p2 = baseTask({ id: "p2task", priority: "p2", status: "ready" });
  const p0 = baseTask({ id: "p0task", priority: "p0", status: "working" });
  const result = pickCurrentTask([p2, p0]);
  assertEqual(result.task?.id, "p0task", "pickCurrentTask prefers p0 over p2");
  assertEqual(result.extraCount, 1, "pickCurrentTask extraCount counts remainder");
}

// pickCurrentTask: same priority, earlier deadline wins; null deadline last
{
  const later = baseTask({
    id: "later",
    priority: "p1",
    status: "ready",
    deadline: new Date("2026-09-10"),
  });
  const sooner = baseTask({
    id: "sooner",
    priority: "p1",
    status: "ready",
    deadline: new Date("2026-09-01"),
  });
  const noDeadline = baseTask({
    id: "nodeadline",
    priority: "p1",
    status: "ready",
    deadline: null,
  });
  const result = pickCurrentTask([later, noDeadline, sooner]);
  assertEqual(result.task?.id, "sooner", "pickCurrentTask prefers earlier deadline");
  assertEqual(result.extraCount, 2, "pickCurrentTask extraCount with 3 open tasks");
}

// pickCurrentTask: priority outranks deadline
{
  const p0NoDeadline = baseTask({
    id: "p0nodeadline",
    priority: "p0",
    status: "ready",
    deadline: null,
  });
  const p2NearDeadline = baseTask({
    id: "p2neardeadline",
    priority: "p2",
    status: "ready",
    deadline: new Date("2026-09-01"),
  });
  const result = pickCurrentTask([p2NearDeadline, p0NoDeadline]);
  assertEqual(result.task?.id, "p0nodeadline", "pickCurrentTask priority outranks deadline");
}

// isMissingContext
assertEqual(
  isMissingContext(baseTask({ readinessScore: 49 })),
  true,
  "isMissingContext true when score < 50",
);
assertEqual(
  isMissingContext(baseTask({ readinessScore: 90, requirementPresent: false })),
  true,
  "isMissingContext true when requirement missing",
);
assertEqual(
  isMissingContext(
    baseTask({ readinessScore: 90, requirementPresent: true, rulesPresent: true, acPresent: true }),
  ),
  false,
  "isMissingContext false when score high and all present",
);

// isUiReadyForDev
assertEqual(
  isUiReadyForDev(baseTask({ figmaReady: true, status: "ready" })),
  true,
  "isUiReadyForDev true for figmaReady + ready",
);
assertEqual(
  isUiReadyForDev(baseTask({ figmaReady: true, status: "not_ready" })),
  true,
  "isUiReadyForDev true for figmaReady + not_ready",
);
assertEqual(
  isUiReadyForDev(baseTask({ figmaReady: true, status: "working" })),
  false,
  "isUiReadyForDev false once work has started",
);
assertEqual(
  isUiReadyForDev(baseTask({ figmaReady: false, status: "ready" })),
  false,
  "isUiReadyForDev false when figma not ready",
);

// computeAttentionCounts
{
  const tasks: HomeTask[] = [
    baseTask({ id: "missing1", readinessScore: 10 }),
    baseTask({ id: "blocked1", status: "blocked", readinessScore: 90 }),
    baseTask({ id: "uiready1", figmaReady: true, status: "ready", readinessScore: 90 }),
    baseTask({ id: "fine1", readinessScore: 90 }),
  ];
  const counts = computeAttentionCounts(tasks);
  assertEqual(
    counts,
    { missingContext: 1, blocked: 1, uiReadyForDev: 1 },
    "computeAttentionCounts tallies each bucket independently",
  );
}

console.log("All home logic checks passed.");
