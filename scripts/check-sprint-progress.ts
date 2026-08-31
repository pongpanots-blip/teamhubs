import assert from "node:assert/strict";
import {
  daysLeft,
  loadByPerson,
  sprintProgress,
  type SprintCard,
} from "../src/components/sprints/types";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok   ${name}`);
}

const card = (over: Partial<SprintCard> = {}): SprintCard => ({
  id: Math.random().toString(36).slice(2),
  title: "card",
  status: "ready",
  storyPoints: null,
  assigneeName: null,
  ...over,
});

check("progress is measured in points once the sprint is sized", () => {
  const p = sprintProgress([
    card({ status: "done", storyPoints: 3 }),
    card({ status: "working", storyPoints: 5 }),
  ]);
  assert.equal(p.donePoints, 3);
  assert.equal(p.totalPoints, 8);
  assert.equal(p.percent, 38);
});

check("an unsized sprint counts cards instead of showing a stuck 0%", () => {
  const p = sprintProgress([card({ status: "done" }), card(), card({ status: "review" })]);
  assert.equal(p.totalPoints, 0);
  assert.equal(p.percent, 33);
});

check("an empty sprint is 0%, not NaN", () => {
  assert.equal(sprintProgress([]).percent, 0);
});

check("a partly sized sprint still reports by points", () => {
  // The unsized card counts as zero — sizing it is the fix, not a fallback.
  const p = sprintProgress([card({ status: "done", storyPoints: 2 }), card()]);
  assert.equal(p.percent, 100);
  assert.equal(p.doneCards, 1);
  assert.equal(p.totalCards, 2);
});

check("days left counts whole days and goes negative when overdue", () => {
  const now = new Date("2026-08-31T00:00:00.000Z");
  assert.equal(daysLeft("2026-09-03T00:00:00.000Z", now), 3);
  assert.equal(daysLeft("2026-08-31T00:00:00.000Z", now), 0);
  assert.equal(daysLeft("2026-08-29T00:00:00.000Z", now), -2);
});

check("load is grouped per person with unassigned last", () => {
  const groups = loadByPerson([
    card({ assigneeName: "Mia", storyPoints: 3, status: "done" }),
    card({ assigneeName: null, storyPoints: 1 }),
    card({ assigneeName: "Kai", storyPoints: 2 }),
    card({ assigneeName: "Mia", storyPoints: 5 }),
  ]);
  assert.deepEqual(
    groups.map((g) => g.name),
    ["Kai", "Mia", null],
  );
  const mia = groups.find((g) => g.name === "Mia")!;
  assert.equal(mia.points, 8);
  assert.equal(mia.donePoints, 3);
});

console.log(`\nall ${passed} checks passed`);
