import Link from "next/link";
import { pickCurrentTask, type HomeTask } from "@/lib/home";
import type { TeamRoleValue } from "@/lib/task-constants";
import { projectTask } from "@/lib/routes";

export type TeamMemberRow = {
  id: string;
  name: string;
  role: TeamRoleValue;
  tasks: HomeTask[];
};

export function TeamSection({
  members,
  projectSlug,
}: {
  members: TeamMemberRow[];
  projectSlug: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-[15px] font-semibold">Team</h2>
      {members.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No team members yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {members.map((member) => {
            const { task, extraCount } = pickCurrentTask(member.tasks);
            return (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-[10px] border border-border p-3"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {member.name[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium">{member.name}</div>
                  <div className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    {member.role}
                  </div>
                </div>
                <div className="ml-auto max-w-[160px] text-right text-xs text-muted-foreground">
                  {task ? (
                    <Link href={projectTask(projectSlug, task.id)} className="hover:underline">
                      {task.title}
                      {extraCount > 0 ? ` +${extraCount} more` : ""}
                    </Link>
                  ) : (
                    "No active task"
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
