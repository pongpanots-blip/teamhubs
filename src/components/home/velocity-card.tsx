/** Same visual language as AttentionSection's tiles — one glanceable figure. */
export function VelocityCard({
  headcount,
  uiCount,
  devCount,
  weeklyPoints,
}: {
  headcount: number;
  uiCount: number;
  devCount: number;
  weeklyPoints: number;
}) {
  return (
    <section>
      <h2 className="mb-3 text-section font-semibold">Sprint velocity</h2>
      <div
        className="flex flex-col gap-1 rounded-xl p-4"
        style={{ backgroundColor: "var(--violet-bg)" }}
      >
        <span
          className="text-figure font-semibold tracking-tight"
          style={{ color: "var(--violet)" }}
        >
          {weeklyPoints}
          <span className="ml-1.5 text-sm font-normal text-muted-foreground">pts/week</span>
        </span>
        <span className="text-xs text-muted-foreground">
          {headcount === 0
            ? "No UI/dev on this project yet"
            : `${devCount} dev + ${uiCount} UI × 7h/day, 1 point = 1 hour`}
        </span>
      </div>
    </section>
  );
}
