"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ProjectSwitcher({
  projects,
  currentSlug,
}: {
  projects: { slug: string; name: string }[];
  currentSlug: string;
}) {
  const [switching, setSwitching] = useState(false);
  if (projects.length <= 1) return null;

  async function switchTo(slug: string) {
    setSwitching(true);
    await fetch("/api/projects/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    window.location.reload();
  }

  return (
    <Select value={currentSlug} onValueChange={(v) => v && switchTo(v)} disabled={switching}>
      <SelectTrigger className="h-8 w-auto min-w-[8rem] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {projects.map((p) => (
          <SelectItem key={p.slug} value={p.slug}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
