"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuickTaskForm, type QuickTaskMember } from "@/components/tasks/quick-task-form";
import type { SprintOption } from "@/components/tasks/sprint-select";

/**
 * The fast path for a task whose scope is already clear — skips the Grill
 * interview and posts straight to the API. Grilling stays the way in for
 * anything that needs the AI to pull requirement/AC/rules out of a PM.
 */
export function QuickTaskDialog({
  projectSlug,
  sprints,
  members,
  trigger,
  open,
  onOpenChange,
}: {
  projectSlug: string;
  sprints: SprintOption[];
  members: QuickTaskMember[];
  /** Omit when this dialog is opened externally (e.g. from a menu item). */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            For work whose scope is already clear. Need help pulling out
            requirements? Use Grill with AI instead.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <QuickTaskForm
            projectSlug={projectSlug}
            sprints={sprints}
            members={members}
            onCreated={() => {
              onOpenChange?.(false);
              router.refresh();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
