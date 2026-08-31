import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/analytics/format";
import type { ServiceLevel } from "@/lib/analytics/percentile";

/** Below this, the percentiles describe luck more than they describe the team. */
const MIN_MEANINGFUL_SAMPLE = 10;

/**
 * The team's Service Level Expectation, stated the way it is meant to be used:
 * "85% of cards finish within X". Read off history rather than promised.
 */
export function SleSummary({ sle, windowDays }: { sle: ServiceLevel; windowDays: number }) {
  const tiers = [
    { label: "Half of cards", value: sle.p50 },
    { label: "85% of cards", value: sle.p85 },
    { label: "95% of cards", value: sle.p95 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service level</CardTitle>
        <CardDescription>
          {sle.sampleSize === 0
            ? `No cards finished in the last ${windowDays} days.`
            : sle.sampleSize < MIN_MEANINGFUL_SAMPLE
              ? `Based on only ${sle.sampleSize} finished card(s) — treat as a hint, not a commitment.`
              : `From ${sle.sampleSize} cards finished in the last ${windowDays} days.`}
          {sle.sampleSize > 0 && " Durations are working time — weekends excluded."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tiers.map((tier) => (
          <div key={tier.label}>
            <p className="text-xs text-muted-foreground">{tier.label} finish within</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {formatDuration(tier.value)}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
