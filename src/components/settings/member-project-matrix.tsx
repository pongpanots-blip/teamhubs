"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TEAM_ROLES, TEAM_ROLE_LABEL } from "@/lib/task-constants";

export type MatrixProject = { id: string; slug: string; name: string };
export type MatrixMember = {
  id: string;
  name: string;
  email: string;
  teamRole: string;
  /** projectId → role in that project. Absent means no access. */
  projectRoles: Record<string, string>;
};

const NONE = "__none__";

/**
 * Who can open which project, in one grid. The per-project settings page can
 * only answer "who is in this project"; assigning one person across several
 * projects meant opening each one in turn.
 */
export function MemberProjectMatrix({
  members,
  projects,
}: {
  members: MatrixMember[];
  projects: MatrixProject[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function setRole(member: MatrixMember, project: MatrixProject, role: string) {
    const cell = `${member.id}:${project.id}`;
    setPending(cell);
    setMsg(null);
    const removing = role === NONE;
    const res = await fetch(`/api/projects/${project.id}/members`, {
      method: removing ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(removing ? { userId: member.id } : { userId: member.id, role }),
    });
    const data = await res.json();
    setPending(null);
    if (!res.ok) {
      setMsg(data.error ?? "Failed");
      return;
    }
    setMsg(
      removing
        ? `เอา ${member.name} ออกจาก ${project.name} แล้ว${
            data.unassignedTasks ? ` (คืนงานที่ถืออยู่ ${data.unassignedTasks} ใบ)` : ""
          }`
        : `${member.name} → ${project.name} เป็น ${TEAM_ROLE_LABEL[role as keyof typeof TEAM_ROLE_LABEL] ?? role}`,
    );
    router.refresh();
  }

  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">ยังไม่มี project ในทีมนี้</p>;
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-card px-2 py-2 text-left font-medium">คน</th>
              {projects.map((p) => (
                <th key={p.id} className="px-2 py-2 text-left font-medium whitespace-nowrap">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="sticky left-0 bg-card px-2 py-2 align-middle">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.email}
                    {m.teamRole === "pm" ? " · PM (เข้าได้ทุก project)" : ""}
                  </div>
                </td>
                {projects.map((p) => (
                  <td key={p.id} className="px-2 py-2 align-middle">
                    <Select
                      value={m.projectRoles[p.id] ?? NONE}
                      onValueChange={(v) => v && setRole(m, p, v)}
                    >
                      <SelectTrigger
                        className="h-7 w-[132px] text-xs"
                        disabled={pending === `${m.id}:${p.id}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— ไม่ได้อยู่ —</SelectItem>
                        {TEAM_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {TEAM_ROLE_LABEL[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg ? <p className="text-sm">{msg}</p> : null}
      <p className="text-xs text-muted-foreground">
        PM เปิดได้ทุก project อยู่แล้ว แต่ต้องมีแถวในตารางนี้จึงจะรับงานใน project นั้นได้
      </p>
    </div>
  );
}
