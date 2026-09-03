import { TaskDetailContent } from "@/components/tasks/task-detail-content";

type Props = { params: Promise<{ projectSlug: string; id: string }> };

export default async function TaskDetailPage({ params }: Props) {
  const { projectSlug, id } = await params;
  return <TaskDetailContent projectSlug={projectSlug} id={id} />;
}
