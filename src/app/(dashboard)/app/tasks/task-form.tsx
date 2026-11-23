"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { weddingTimeZoneLabel } from "@/modules/events/wedding-time";
import { taskDayStart, taskDueDay } from "@/modules/tasks/due-date";
import type { taskOptions, TaskDetails } from "@/modules/tasks/service";
import { createTaskSchema, taskDescriptionLimit, taskPriorities, taskStatuses, taskTitleLimit } from "@/modules/tasks/validation";
import { useWorkspaceDraft } from "../_components/workspace-draft";
import styles from "./tasks.module.css";

function initialDraft(timeZone: string, task?: TaskDetails) {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    assignedMembershipId: task?.assignedMembershipId ?? "",
    eventId: task?.eventId ?? "",
    dueDate: task?.dueDate ? taskDueDay(task.dueDate, timeZone) : "",
    priority: task?.priority ?? "MEDIUM",
    status: task?.status ?? "TODO",
  };
}

type Draft = ReturnType<typeof initialDraft>;
type Field = keyof Draft;
type FieldErrors = Partial<Record<Field, string>>;
type Problem = { message: string; action: "login" | "reload" | "retry" | "review" | "createNew" };

export function TaskForm({ task, options, timeZone, context }: {
  task?: TaskDetails;
  options: Awaited<ReturnType<typeof taskOptions>>;
  timeZone: string;
  context: string;
}) {
  const [initial] = useState(() => initialDraft(timeZone, task));
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<Problem>();
  const [saving, setSaving] = useState(false);
  const request = useRef<{ body: string; key: string } | null>(null);
  const dirty = Object.keys(initial).some((field) => initial[field as Field] !== draft[field as Field]);
  const { leaveFor, allowNavigation } = useWorkspaceDraft(dirty, saving);
  const returnUrl = task ? `/app/tasks/${task.id}` : "/app/tasks";
  const availableAssignee = options.members.some(({ id }) => id === initial.assignedMembershipId);
  const availableEvent = options.events.some(({ id }) => id === initial.eventId);

  function setField(field: Field, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  function focusErrors(next: FieldErrors) {
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) requestAnimationFrame(() => document.getElementById("task-" + first)?.focus());
  }

  async function submit(submission: FormEvent<HTMLFormElement>) {
    submission.preventDefault();
    if (saving) return;
    setProblem(undefined);

    const normalizedDueDate = initial.dueDate === draft.dueDate && task?.dueDate ? task.dueDate
      : draft.dueDate ? taskDayStart(draft.dueDate, timeZone) : null;
    const parsed = createTaskSchema.safeParse({
      ...draft,
      assignedMembershipId: draft.assignedMembershipId || null,
      eventId: draft.eventId || null,
      dueDate: normalizedDueDate,
    });
    const next: FieldErrors = parsed.success ? {} : Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message]));
    if (draft.dueDate && !normalizedDueDate) next.dueDate = "Choose a date that exists in the wedding timezone.";
    if (Object.keys(next).length) return focusErrors(next);
    if (!parsed.success) return;

    const payload = task ? Object.fromEntries(Object.entries(parsed.data).filter(([field, value]) => {
      if (field === "description") return value !== (task.description ?? "");
      return value !== task[field as keyof TaskDetails];
    })) : parsed.data;
    if (!Object.keys(payload).length) {
      setProblem({ message: "Make a change before saving the task.", action: "review" });
      return;
    }

    const body = JSON.stringify(payload);
    const headers: Record<string, string> = { "Content-Type": "application/json", "X-Task-Draft": context };
    if (task) headers["If-Match"] = JSON.stringify(String(task.revision));
    else {
      if (problem?.action === "createNew" || request.current?.body !== body) {
        request.current = { body, key: crypto.randomUUID() };
      }
      headers["Idempotency-Key"] = request.current.key;
    }
    setErrors({});
    setSaving(true);
    try {
      const result = await fetch(task ? `/api/tasks/${task.id}` : "/api/tasks", {
        method: task ? "PATCH" : "POST", headers, body,
      });
      const response = await result.json().catch(() => null);
      if (result.ok && response?.data?.id) {
        allowNavigation();
        window.location.replace(`/app/tasks/${response.data.id}?notice=${task ? "updated" : "created"}`);
      } else if (result.status === 401) {
        setProblem({ message: "Your session expired. Sign in again to continue this draft.", action: "login" });
      } else if (result.status === 410) {
        setProblem({ message: response?.error?.message || "This task was created and has since been deleted.", action: "createNew" });
      } else if (response?.error?.details && Object.keys(response.error.details).length) {
        focusErrors(response.error.details);
      } else if (result.status === 409 || result.status === 404) {
        setProblem({ message: response?.error?.message || "This task has changed.", action: "reload" });
      } else {
        setProblem({ message: response?.error?.message || "We couldn’t save this task. Your entries are still here.", action: "retry" });
      }
    } catch {
      setProblem({ message: "We couldn’t connect. Your entries are still here.", action: "retry" });
    } finally {
      setSaving(false);
    }
  }

  function field(field: Field, label: string, options?: ReactNode) {
    const id = "task-" + field;
    const error = errors[field];
    const optional = field !== "title" && field !== "status" && field !== "priority";
    const props = {
      id, name: field, value: draft[field], required: !optional,
      className: styles.control,
      onChange: (change: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setField(field, change.currentTarget.value),
      "aria-invalid": error ? true as const : undefined,
      "aria-describedby": error ? id + "-error" : undefined,
    };
    return (
      <div className={styles.field}>
        <label htmlFor={id}>{label}{optional && <small>Optional</small>}</label>
        {options ? <select {...props}>{options}</select>
          : field === "description" ? <textarea {...props} rows={4} maxLength={taskDescriptionLimit} />
            : <input {...props} type={field === "dueDate" ? "date" : "text"} maxLength={field === "title" ? taskTitleLimit : undefined} />}
        {error && <p className={styles.error} id={id + "-error"}>{error}</p>}
      </div>
    );
  }

  return (
    <>
      <Link href="/app/tasks" className={styles.textAction} onNavigate={leaveFor("/app/tasks")}>Back to tasks</Link>
      <header className={styles.heading}><h1>{task ? "Edit task" : "Create task"}</h1></header>
      <form className={styles.taskForm} method="post" onSubmit={submit} aria-busy={saving} noValidate>
        <fieldset className={styles.formFields} disabled={saving}>
          <legend className="sr-only">Task details</legend>
          {field("title", "Task title")}
          {field("description", "Description")}
          <div className={styles.pair}>
            {field("assignedMembershipId", "Assignee", <>
              <option value="">Unassigned</option>
              {initial.assignedMembershipId && !availableAssignee &&
                <option value={initial.assignedMembershipId} disabled={draft.assignedMembershipId !== initial.assignedMembershipId}>Former member</option>}
              {options.members.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </>)}
            {field("eventId", "Related event", <>
              <option value="">No related event</option>
              {initial.eventId && !availableEvent &&
                <option value={initial.eventId} disabled={draft.eventId !== initial.eventId}>
                  {task?.event?.name ? `${task.event.name} (archived)` : "Unavailable event"}
                </option>}
              {options.events.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </>)}
          </div>
          <div className={styles.pair}>
            {field("priority", "Priority", Object.entries(taskPriorities).map(([value, label]) => <option key={value} value={value}>{label}</option>))}
            {field("status", "Status", Object.entries(taskStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>))}
          </div>
          <div className={styles.dueField}>{field("dueDate", "Due date")}<p>{weddingTimeZoneLabel(timeZone)}</p></div>
        </fieldset>
        {problem && <div className={styles.problem} role="alert">
          <p>{problem.message}</p>
          {problem.action === "login" && <Link href="/login" target="_blank" rel="noopener">Open login in a new tab</Link>}
          {problem.action === "reload" && <Link href={returnUrl} target="_blank" rel="noopener">Open the current version in a new tab</Link>}
        </div>}
        <div className={styles.formActions}>
          <Link href={returnUrl} className={styles.secondary} onNavigate={leaveFor(returnUrl)}>Cancel</Link>
          <button type="submit" className={styles.primary} disabled={saving || Boolean(task && !dirty)}>
            {saving ? "Saving…" : problem?.action === "retry" ? "Try again" : task ? "Save changes"
              : problem?.action === "createNew" ? "Create a new task" : "Create task"}
          </button>
        </div>
      </form>
    </>
  );
}
