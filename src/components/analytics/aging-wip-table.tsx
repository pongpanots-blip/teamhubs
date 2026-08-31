import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TaskStatusBadge } from "@/components/tasks/status-badge";
import { formatDuration } from "@/lib/analytics/format";
import { projectTask } from "@/lib/routes";
import type { AgingCard } from "@/lib/analytics/flow";

/**
 * Cards in flight, oldest first. This is the one table worth checking daily:
 * it warns while a card can still be helped, rather than reporting at the retro
 * that it was late.
 */
export function AgingWipTable({
  cards,
  projectSlug,
  sleMs,
}: {
  cards: AgingCard[];
  projectSlug: string;
  sleMs: number | null;
}) {
  const breached = cards.filter((c) => c.breachesSle).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Aging work in progress</CardTitle>
        <CardDescription>
          {sleMs === null
            ? "No service level yet — finish a few cards and a threshold appears here."
            : `${breached} of ${cards.length} in-flight card(s) have already outlived the ${formatDuration(sleMs)} of working time that 85% come in under.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {cards.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nothing in flight right now.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map((card) => (
                <TableRow key={card.taskId}>
                  <TableCell>
                    <Link
                      href={projectTask(projectSlug, card.taskId)}
                      className="hover:underline"
                    >
                      {card.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <TaskStatusBadge status={card.status} />
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${
                      card.breachesSle ? "font-semibold text-red-600" : "text-slate-600"
                    }`}
                  >
                    {formatDuration(card.wipAgeMs)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
