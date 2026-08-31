import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLOT } from "@/components/analytics/plot";

/**
 * Frame every chart shares: title, the one sentence saying how to read it, and
 * an empty state that says what is missing instead of drawing empty axes.
 */
export function ChartCard({
  title,
  description,
  empty,
  children,
}: {
  title: string;
  description: string;
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="py-8 text-center text-sm text-slate-500">{empty}</p>
        ) : (
          <svg
            viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
            className="w-full"
            role="img"
            aria-label={`${title}. ${description}`}
          >
            {children}
          </svg>
        )}
      </CardContent>
    </Card>
  );
}
