import { parseMentions, type Mentionable } from "../src/lib/comments/mentions";

let failures = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : ` — got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
}

const members: Mentionable[] = [
  { id: "u1", name: "Joe" },
  { id: "u2", name: "Ann Lee" },
  { id: "u3", name: "Joe Anderson" },
];

// No @ in the body → no mentions.
{
  const ids = parseMentions("just a plain comment", members);
  assertEqual(ids, [], "plain text has no mentions");
}

// Single, unambiguous match.
{
  const ids = parseMentions("hey @Joe can you check this", members);
  assertEqual(ids, ["u1"], "single mention resolves to that user");
}

// Longest match wins so "@Joe Anderson" doesn't resolve to "Joe".
{
  const ids = parseMentions("cc @Joe Anderson please", members);
  assertEqual(ids, ["u3"], "longest matching name wins over a shorter prefix");
}

// Multi-word name matches as a unit.
{
  const ids = parseMentions("ping @Ann Lee about this", members);
  assertEqual(ids, ["u2"], "multi-word name matches as one mention");
}

// A name with no matching member is ignored, not an error.
{
  const ids = parseMentions("@Nobody see this", members);
  assertEqual(ids, [], "unmatched @name yields no mention");
}

// Same person mentioned twice → id appears once.
{
  const ids = parseMentions("@Joe are you there? cc @Joe again", members);
  assertEqual(ids, ["u1"], "duplicate mentions of the same person dedupe");
}

// Two different people in one comment.
{
  const ids = parseMentions("@Joe and @Ann Lee please review", members);
  assertEqual(ids, ["u1", "u2"], "two distinct mentions both resolve, in order of first appearance");
}

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall passed");
