"use client";

import { useRef, useState } from "react";
import styles from "../guests.module.css";

export function DeleteGuest({ id, name, revision, context }: { id: string; name: string; revision: number; context: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setError("");
    setPending(true);
    try {
      const result = await fetch(`/api/guests/${id}`, {
        method: "DELETE",
        headers: { "If-Match": JSON.stringify(String(revision)), "X-Guest-Draft": context },
      });
      if (result.ok) {
        window.location.replace("/app/guests?notice=deleted");
        return;
      }
      const body = await result.json().catch(() => null);
      setError(body?.error?.message || "We couldn’t delete this guest group. Try again.");
    } catch {
      setError("We couldn’t connect. Try deleting this guest group again.");
    }
    setPending(false);
  }

  return (
    <>
      <button type="button" className={styles.secondary} onClick={() => {
        setError("");
        dialog.current?.showModal();
      }}>Delete guest group</button>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby="guest-delete-title" aria-describedby="guest-delete-description"
        onCancel={(event) => { if (pending) event.preventDefault(); }}>
        <h2 id="guest-delete-title">Delete this guest group?</h2>
        <p id="guest-delete-description"><strong>{name}’s</strong> guest group will be permanently deleted.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.formActions}>
          <button type="button" className={styles.secondary} disabled={pending} onClick={() => dialog.current?.close()}>Cancel</button>
          <button type="button" className={styles.danger} disabled={pending} onClick={() => void remove()}>
            {pending ? "Deleting…" : "Delete guest group"}
          </button>
        </div>
      </dialog>
    </>
  );
}
