import type { Metadata } from "next";
import Link from "next/link";
import { taskDueDay } from "@/modules/tasks/due-date";
import { taskDraftContext } from "@/modules/tasks/service";
import { taskPriorities, taskStatuses } from "@/modules/tasks/validation";
import { formatWeddingDate } from "@/modules/wedding/wedding-date";
import { WorkspaceFormLink } from "../../_components/workspace-form-link";
import { requireWorkspaceTask } from "../_workspace";
import { TaskActions } from "../task-actions";
import styles from "../tasks.module.css";

export const metadata: Metadata = { title: "Task details" };
const notices = { created: "Task added.", updated: "Task updated.", completed: "Task completed.", reopened: "Task reopened." } as const;

export default async function TaskPage({ params, searchParams }: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { membershipId, wedding, task } = await requireWorkspaceTask((await params).taskId);
  const { notice } = await searchParams;
  const { id, title, status, revision } = task;
  const details = [
    { label: "Status", value: taskStatuses[status] },
    { label: "Priority", value: taskPriorities[task.priority] },
    { label: "Assignee", value: task.assignee?.name || (task.assignedMembershipId ? "Former member" : "Unassigned") },
    { label: "Related event", value: task.event ? task.event.name + (task.event.archivedAt ? " (archived)" : "")
      : task.eventId ? "Unavailable event" : "No related event" },
    { label: "Due date", value: task.dueDate ? formatWeddingDate(taskDueDay(task.dueDate, wedding.timeZone)) : "No due date" },
    { label: "Description", value: task.description },
  ];
  return (
    <>
      <Link href="/app/tasks" className={styles.textAction}>Back to tasks</Link>
      <header className={styles.heading}>
        <h1>{title}</h1>
        <WorkspaceFormLink className={styles.primary} href={`/app/tasks/${id}/edit`}>Edit task</WorkspaceFormLink>
      </header>
      {notice && Object.hasOwn(notices, notice) && <p role="status" className={styles.notice}>{notices[notice as keyof typeof notices]}</p>}
      <dl className={styles.details}>
        {details.map(({ label, value }) => value && <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <TaskActions task={{ id, title, status, revision }} returnUrl={`/app/tasks/${id}`}
        context={taskDraftContext(membershipId, wedding.id, wedding.timeZone)} />
    </>
  );
}
