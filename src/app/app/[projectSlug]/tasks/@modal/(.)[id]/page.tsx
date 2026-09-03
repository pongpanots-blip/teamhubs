import { TaskDetailContent } from "@/components/tasks/task-detail-content";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";

type Props = { params: Promise<{ projectSlug: string; id: string }> };

export default async function InterceptedTaskDetailModal({ params }: Props) {
  const { projectSlug, id } = await params;
  return (
    <TaskDetailModal>
      <TaskDetailContent projectSlug={projectSlug} id={id} />
    </TaskDetailModal>
  );
}
