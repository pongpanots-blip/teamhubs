import { resolveRecommendation } from "../src/lib/ai/grill-recommendation";

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${label}: expected ${e}, got ${a}`);
  }
  console.log(`ok - ${label}`);
}

// recommendation matches a choice -> badge that choice, no hint text
assertEqual(
  resolveRecommendation(["มี", "ไม่มี"], "มี"),
  { matchedChoice: "มี", hintText: null },
  "recommendation matches a choice",
);

// recommendation doesn't match any choice -> hint text, no badge
assertEqual(
  resolveRecommendation(["มี", "ไม่มี"], "ขึ้นกับ scope"),
  { matchedChoice: null, hintText: "ขึ้นกับ scope" },
  "recommendation not among choices",
);

// open-ended question: no choices at all -> hint text
assertEqual(
  resolveRecommendation(null, "10% — ตาม tier ส่วนลดที่ใช้อยู่แล้ว"),
  { matchedChoice: null, hintText: "10% — ตาม tier ส่วนลดที่ใช้อยู่แล้ว" },
  "no choices, recommendation is free text",
);

// no recommendation at all (e.g. heuristic offline mode) -> neither
assertEqual(
  resolveRecommendation(["มี", "ไม่มี"], null),
  { matchedChoice: null, hintText: null },
  "no recommendation",
);

console.log("all checks passed");
