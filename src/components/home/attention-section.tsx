import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttentionCounts } from "@/lib/home";

const ATTENTION_ITEMS: {
  key: keyof AttentionCounts;
  emoji: string;
  label: (count: number) => string;
  query: string;
}[] = [
  {
    key: "missingContext",
    emoji: "⚠",
    label: (n) => `${n} Missing Context`,
    query: "missing_context",
  },
  {
    key: "blocked",
    emoji: "🚧",
    label: (n) => `${n} Blocked`,
    query: "blocked",
  },
  {
    key: "uiReadyForDev",
    emoji: "🎨",
    label: (n) => `${n} UI Ready for Dev`,
    query: "ui_ready",
  },
];

export function AttentionSection({ counts }: { counts: AttentionCounts }) {
  return (
    <Card className="border-black/5 bg-white/80">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900">Attention</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {ATTENTION_ITEMS.map((item) => (
          <Link
            key={item.key}
            href={`/app/tasks?attention=${item.query}`}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-900/5"
          >
            <span aria-hidden>{item.emoji}</span>
            <span>{item.label(counts[item.key])}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
