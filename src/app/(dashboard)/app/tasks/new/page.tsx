import type { Metadata } from "next";
import { taskDraftContext, taskOptions } from "@/modules/tasks/service";
import { requireTaskWorkspace } from "../_workspace";
import { TaskForm } from "../task-form";

export const metadata: Metadata = { title: "Create wedding task" };

export default async function NewTaskPage() {
  const { membershipId, wedding } = await requireTaskWorkspace();
  const options = await taskOptions(wedding.id);
  return <TaskForm options={options} timeZone={wedding.timeZone} context={taskDraftContext(membershipId, wedding.id, wedding.timeZone)} />;
}
