import Link from "next/link";
import type { AttentionCounts } from "@/lib/home";
import { projectTasks } from "@/lib/routes";

const ATTENTION_ITEMS: {
  key: keyof AttentionCounts;
  emoji: string;
  label: string;
  query: string;
  color: string;
  bg: string;
}[] = [
  {
    key: "missingContext",
    emoji: "⚠",
    label: "Missing context",
    query: "missing_context",
    color: "var(--st-working-strong)",
    bg: "var(--st-working-bg)",
  },
  {
    key: "blocked",
    emoji: "🚧",
    label: "Blocked",
    query: "blocked",
    color: "var(--st-blocked)",
    bg: "var(--st-blocked-bg)",
  },
  {
    key: "uiReadyForDev",
    emoji: "🎨",
    label: "UI ready for dev",
    query: "ui_ready",
    color: "var(--st-done)",
    bg: "var(--st-done-bg)",
  },
];

export function AttentionSection({
  counts,
  projectSlug,
}: {
  counts: AttentionCounts;
  projectSlug: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-section font-semibold">Attention</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ATTENTION_ITEMS.map((item) => (
          <Link
            key={item.key}
            href={`${projectTasks(projectSlug)}?attention=${item.query}`}
            className="flex flex-col gap-1 rounded-xl p-4"
            style={{ backgroundColor: item.bg }}
          >
            <span className="text-figure font-semibold tracking-tight" style={{ color: item.color }}>
              {counts[item.key]}
            </span>
            <span className="text-xs font-medium" style={{ color: item.color }}>
              <span aria-hidden>{item.emoji}</span> {item.label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
