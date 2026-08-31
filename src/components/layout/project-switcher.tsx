"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { projectHome } from "@/lib/routes";

/**
 * Switching navigates to the new project's home rather than the equivalent page:
 * ids in the current URL belong to the project you are leaving, so carrying the
 * path across would land on something that isn't there.
 */
export function ProjectSwitcher({
  projects,
  currentSlug,
}: {
  projects: { slug: string; name: string }[];
  currentSlug: string;
}) {
  const router = useRouter();
  if (projects.length <= 1) return null;

  return (
    <Select
      value={currentSlug}
      onValueChange={(slug) => {
        if (slug && slug !== currentSlug) router.push(projectHome(slug));
      }}
    >
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
