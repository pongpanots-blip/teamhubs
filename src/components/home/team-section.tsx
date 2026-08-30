import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { pickCurrentTask, type HomeTask } from "@/lib/home";

export type TeamMemberRow = {
  id: string;
  name: string;
  role: "pm" | "ui" | "dev";
  tasks: HomeTask[];
};

export function TeamSection({ members }: { members: TeamMemberRow[] }) {
  return (
    <Card className="border-black/5 bg-white/80">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900">Team</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {members.map((member) => {
          const { task, extraCount } = pickCurrentTask(member.tasks);
          return (
            <div
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{member.name}</span>
                <Badge variant="outline" className="uppercase">
                  {member.role}
                </Badge>
              </div>
              <div className="text-slate-600">
                {task ? (
                  <span className="flex items-center gap-1">
                    <span aria-hidden>→</span>
                    <Link href={`/app/tasks/${task.id}`} className="hover:underline">
                      {task.title}
                    </Link>
                    {extraCount > 0 ? (
                      <span className="text-xs text-slate-400">+{extraCount} more</span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-slate-400">No active task</span>
                )}
              </div>
            </div>
          );
        })}
        {members.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">No team members yet.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
