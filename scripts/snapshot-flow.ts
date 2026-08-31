import { captureFlowSnapshot } from "../src/lib/analytics/snapshot";

/**
 * Daily job behind the Cumulative Flow Diagram. Safe to re-run: the same day's
 * rows are overwritten, not appended.
 */
async function main() {
  const result = await captureFlowSnapshot();
  console.log(`snapshot written: ${result.rows} rows across ${result.projects} project(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
