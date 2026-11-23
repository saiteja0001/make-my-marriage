import type { Metadata } from "next";
import { taskDraftContext, taskOptions } from "@/modules/tasks/service";
import { requireWorkspaceTask } from "../../_workspace";
import { TaskForm } from "../../task-form";

export const metadata: Metadata = { title: "Edit wedding task" };

export default async function EditTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { membershipId, task, wedding } = await requireWorkspaceTask((await params).taskId);
  const options = await taskOptions(wedding.id);
  return <TaskForm key={task.id} task={task} options={options} timeZone={wedding.timeZone}
    context={taskDraftContext(membershipId, wedding.id, wedding.timeZone)} />;
}
