"use client";

import { useId, useRef, useState } from "react";
import styles from "../events.module.css";

export function ArchiveEvent({ id, name, draft }: { id: string; name: string; draft: string }) {
  const dialogId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function archive() {
    setError("");
    setPending(true);
    try {
      const response = await fetch(`/api/events/${id}`, { method: "DELETE", headers: { "X-Event-Draft": draft } });
      if (response.ok) {
        window.location.replace("/app/events?notice=archived");
        return;
      }
      const payload = await response.json().catch(() => null);
      setError(payload?.error?.message || "We couldn’t archive this event. Try again.");
    } catch {
      setError("We couldn’t connect. Try archiving this event again.");
    }
    setPending(false);
  }

  return (
    <>
      <button type="button" className={styles.secondary} aria-label={`Archive ${name}`} onClick={() => {
        setError("");
        dialog.current?.showModal();
      }}>Archive event</button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={dialogId + "-title"}
        aria-describedby={dialogId + "-description"}
        onCancel={(event) => { if (pending) event.preventDefault(); }}
      >
        <h2 id={dialogId + "-title"}>Archive this event?</h2>
        <p id={dialogId + "-description"}><strong>{name}</strong> will move to Archived and disappear from the active schedule and upcoming dashboard events.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} disabled={pending} onClick={() => dialog.current?.close()}>Cancel</button>
          <button type="button" className={styles.danger} disabled={pending} onClick={() => void archive()}>
            {pending ? "Archiving…" : error ? "Try again" : "Archive event"}
          </button>
        </div>
      </dialog>
    </>
  );
}
