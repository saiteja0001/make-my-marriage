"use client";

import { useRef, useState, useId } from "react";
import type { TaskDetails } from "@/modules/tasks/service";
import styles from "./tasks.module.css";

export function TaskActions({ task, context, returnUrl, deleteReturnUrl = "/app/tasks" }: {
  task: Pick<TaskDetails, "id" | "title" | "status" | "revision">;
  context: string;
  returnUrl: string;
  deleteReturnUrl?: string;
}) {
  const dialogId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<"status" | "delete" | null>(null);
  const [error, setError] = useState<{ message: string; action: "status" | "delete" }>();
  const done = task.status === "COMPLETED";

  async function mutate(action: "status" | "delete") {
    if (pending) return;
    setError(undefined);
    setPending(action);
    const remove = action === "delete";
    try {
      const result = await fetch(`/api/tasks/${task.id}`, {
        method: remove ? "DELETE" : "PATCH",
        headers: {
          "Content-Type": "application/json",
          "If-Match": JSON.stringify(String(task.revision)),
          "X-Task-Draft": context,
        },
        body: remove ? undefined : JSON.stringify({ status: done ? "TODO" : "COMPLETED" }),
      });
      if (result.ok) {
        const next = new URL(remove ? deleteReturnUrl : returnUrl, window.location.origin);
        next.searchParams.set("notice", remove ? "deleted" : done ? "reopened" : "completed");
        window.location.replace(next);
        return;
      }
      const payload = await result.json().catch(() => null);
      setError({ action, message: payload?.error?.message || "We couldn’t update this task. Try again." });
    } catch {
      setError({ action, message: "We couldn’t connect. Try again." });
    }
    setPending(null);
  }

  return (
    <div>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={() => void mutate("status")} disabled={pending !== null}
          aria-label={`${done ? "Reopen" : "Complete"} ${task.title}`}>
          {pending === "status" ? "Updating…" : done ? "Reopen" : "Complete"}
        </button>
        <button type="button" className={styles.textAction} disabled={pending !== null} aria-label={`Delete ${task.title}`}
          onClick={() => { setError(undefined); dialog.current?.showModal(); }}>Delete</button>
      </div>
      {error?.action === "status" && <p className={styles.error} role="alert">{error.message}</p>}
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={dialogId + "-title"} aria-describedby={dialogId + "-description"}
        onCancel={(event) => { if (pending) event.preventDefault(); }}>
        <h2 id={dialogId + "-title"}>Delete this task?</h2>
        <p id={dialogId + "-description"}><strong>{task.title}</strong> will be permanently deleted.</p>
        {error?.action === "delete" && <p className={styles.error} role="alert">{error.message}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} disabled={pending !== null} onClick={() => dialog.current?.close()}>Cancel</button>
          <button type="button" className={styles.danger} disabled={pending !== null} onClick={() => void mutate("delete")}>
            {pending === "delete" ? "Deleting…" : "Delete task"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
