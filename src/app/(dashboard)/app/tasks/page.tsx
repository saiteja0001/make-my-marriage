import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { taskDueDay, taskDueState } from "@/modules/tasks/due-date";
import { getTaskCounts, listTasks, taskDraftContext, taskOptions } from "@/modules/tasks/service";
import { taskListSchema, taskPriorities, taskStatuses, type TaskFilters as TaskFiltersValues } from "@/modules/tasks/validation";
import { formatWeddingDate, weddingLocalDate } from "@/modules/wedding/wedding-date";
import { WorkspaceFormLink } from "../_components/workspace-form-link";
import { requireTaskWorkspace } from "./_workspace";
import { TaskActions } from "./task-actions";
import { TaskFilters } from "./task-filters";
import styles from "./tasks.module.css";

export const metadata: Metadata = { title: "Wedding tasks" };

const views = { all: "All Tasks", mine: "My Tasks", completed: "Completed" } as const;
type View = keyof typeof views;
const notices = { deleted: "Task deleted.", completed: "Task completed.", reopened: "Task reopened." } as const;

function listUrl(view: View, filters?: TaskFiltersValues, page = 1) {
  const query = new URLSearchParams();
  if (view !== "all") query.set("view", view);
  if (page > 1) query.set("page", String(page));
  if (filters) {
    const keys = ["q", "priority", "eventId", "assignedMembershipId", "status"] as const;
    for (const key of keys) {
      const value = filters[key];
      if (value && !(key === "status" && view === "completed")) query.set(key, value);
    }
  }
  return query.size ? "/app/tasks?" + query : "/app/tasks";
}

export default async function TasksPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { membershipId, wedding } = await requireTaskWorkspace();
  const params = await searchParams;
  const view = params.view === "mine" || params.view === "completed" ? params.view : "all";
  const selected = Object.fromEntries(Object.entries(params).filter(([, value]) => typeof value === "string" && value));
  const viewOptions = { mine: String(view === "mine"), ...(view === "completed" && { status: "COMPLETED" }) };
  const parsed = taskListSchema.safeParse({ ...selected, ...viewOptions, limit: undefined });
  const filters = parsed.success ? parsed.data : taskListSchema.parse(viewOptions);
  const [{ data: tasks, pagination }, counts, options] = await Promise.all([
    listTasks(wedding.id, membershipId, filters), getTaskCounts(wedding.id), taskOptions(wedding.id, false),
  ]);
  if (pagination.page > Math.max(1, pagination.totalPages)) redirect(listUrl(view, filters, Math.max(1, pagination.totalPages)));

  const today = weddingLocalDate(new Date(), wedding.timeZone);
  const draft = taskDraftContext(membershipId, wedding.id, wedding.timeZone);
  const currentUrl = listUrl(view, filters, pagination.page);
  const clearUrl = listUrl(view);
  const filtered = Boolean(filters.q || filters.priority || filters.eventId || filters.assignedMembershipId
    || (view !== "completed" && filters.status));
  const notice = typeof params.notice === "string" && Object.hasOwn(notices, params.notice)
    ? notices[params.notice as keyof typeof notices] : null;
  const emptyTitle = filtered ? "No tasks match your filters" : view === "mine" ? "No tasks assigned to you"
    : view === "completed" ? "No completed tasks" : "Your task list is empty";

  return (
    <>
      <header className={styles.heading}>
        <div>
          <h1>Wedding tasks</h1>
          <p>Assign and track the work for {wedding.title || `${wedding.brideName} & ${wedding.groomName}’s wedding`}.</p>
        </div>
        <WorkspaceFormLink href="/app/tasks/new" className={styles.primary}>Add task</WorkspaceFormLink>
      </header>
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      <section className={styles.progress} aria-label="Wedding task progress">
        <p><strong>{counts.completed} of {counts.total}</strong> tasks completed</p>
        <progress aria-label="Task completion" max={Math.max(1, counts.total)} value={counts.completed} />
      </section>

      <nav className={styles.tabs} aria-label="Task views">
        {Object.entries(views).map(([key, label]) => (
          <Link key={key} href={listUrl(key as View)} aria-current={view === key ? "page" : undefined}>{label}</Link>
        ))}
      </nav>
      <TaskFilters key={currentUrl} view={view} filters={filters} options={options} clearUrl={clearUrl} />

      {tasks.length ? (
        <section aria-label="Task list" className={styles.list}>
          <div className={styles.columns} aria-hidden="true">
            <span>Task</span><span>Assignee</span><span>Due date</span><span>Status</span><span>Actions</span>
          </div>
          <ul>
            {tasks.map(({ id, title, status, priority, dueDate, event, eventId, assignee, assignedMembershipId, revision }) => {
              const due = dueDate && taskDueDay(dueDate, wedding.timeZone);
              const urgency = due && taskDueState(status, due, today);
              return (
                <li key={id} className={styles.row} data-done={status === "COMPLETED"}>
                  <div className={styles.taskName}>
                    <h2><Link href={`/app/tasks/${id}`}>{title}</Link></h2>
                    <div className={styles.tags}>
                      <span className={styles.priority} data-priority={priority}>{taskPriorities[priority]} priority</span>
                      {eventId && <span className={styles.eventTag}>{event?.name || "Unavailable event"}{event?.archivedAt ? " (archived)" : ""}</span>}
                    </div>
                  </div>
                  <p className={styles.assignee}>{assignee?.name || (assignedMembershipId ? "Former member" : "Unassigned")}</p>
                  <div className={styles.due}>
                    {urgency && <span data-urgency={urgency}>{urgency === "overdue" ? "Overdue" : "Due today"}</span>}
                    {due ? <time dateTime={due}>{formatWeddingDate(due)}</time> : <span>No due date</span>}
                  </div>
                  <p className={styles.status} data-status={status}>{taskStatuses[status]}</p>
                  <TaskActions task={{ id, title, status, revision }} context={draft} returnUrl={currentUrl} deleteReturnUrl={currentUrl} />
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <section className={styles.empty} aria-label="Empty task list">
          <h2>{emptyTitle}</h2>
          {filtered ? <Link href={clearUrl} className={styles.secondary}>Clear all filters</Link>
            : view === "all" ? <WorkspaceFormLink href="/app/tasks/new" className={styles.primary}>Add your first task</WorkspaceFormLink>
            : <Link href="/app/tasks" className={styles.secondary}>View all tasks</Link>}
        </section>
      )}

      {pagination.totalPages > 1 && <nav aria-label="Task list pages" className={styles.pagination}>
        {pagination.page > 1 && <Link className={styles.secondary} href={listUrl(view, filters, pagination.page - 1)}>Previous</Link>}
        <span>Page {pagination.page} of {pagination.totalPages}</span>
        {pagination.page < pagination.totalPages && <Link className={styles.secondary} href={listUrl(view, filters, pagination.page + 1)}>Next</Link>}
      </nav>}
    </>
  );
}
