"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { defaultWeddingTimeZone, weddingFieldLimits, weddingUpdateSchema } from "@/modules/wedding/validation";
import { WorkspaceHeader } from "../../_components/workspace-header";
import { useWeddingTextInput } from "../../_components/use-wedding-text-input";
import styles from "./edit-wedding.module.css";

type FieldName = "brideName" | "groomName" | "weddingDate" | "location" | "timeZone" | "title" | "description";
type Draft = Record<FieldName, string>;
type FieldErrors = Record<string, string>;
type SaveProblem = { message: string; action?: "login" | "switch"; retry?: boolean };

const fields = [
  "brideName", "groomName", "weddingDate", "location", "timeZone", "title", "description",
] as const;

const fieldLimits = {
  brideName: weddingFieldLimits.name,
  groomName: weddingFieldLimits.name,
  location: weddingFieldLimits.location,
  title: weddingFieldLimits.title,
  description: weddingFieldLimits.description,
};

export function EditWeddingForm({ accountId, weddingId, initial, member, timeZones }: {
  accountId: string;
  weddingId: string;
  initial: Draft;
  member: { name: string; role: "ADMIN" | "MANAGER" };
  timeZones: string[];
}) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<SaveProblem | null>(null);
  const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const pendingLeave = useRef<(() => void) | null>(null);
  const allowNavigation = useRef(false);
  const { textInput: capitalizeInput } = useWeddingTextInput(updateField);
  const changedFields = fields.filter((name) => draft[name] !== initial[name]);
  const dirty = changedFields.length > 0;

  useEffect(() => {
    if (!dirty) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      if (allowNavigation.current) return;
      event.preventDefault();
      event.returnValue = true;
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  function updateField(name: FieldName, value: string) {
    setDraft((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: "", ...(name === "location" && { "location.formattedAddress": "" }) }));
  }

  function leaveOverview(path = "/app") {
    allowNavigation.current = true;
    window.location.replace(path);
  }

  function requestLeave(leave: () => void) {
    if (saving) return;
    if (!dirty) {
      leave();
      return;
    }
    pendingLeave.current = leave;
    dialog.current?.showModal();
  }

  function focusErrors(next: FieldErrors) {
    setErrors(next);
    const first = fields.find((name) => next[name] || (name === "location" && next["location.formattedAddress"]));
    if (first) requestAnimationFrame(() => document.getElementById("edit-" + first)?.focus());
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || saving) return;
    setProblem(null);

    const changes = Object.fromEntries(changedFields.map((name) => [
      name,
      name === "location" ? { formattedAddress: draft.location } : draft[name],
    ]));
    const parsed = weddingUpdateSchema.safeParse(changes);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
      focusErrors(next);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const response = await fetch("/api/wedding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, draftAccountId: accountId, draftWeddingId: weddingId }),
      });
      if (response.ok) {
        leaveOverview("/app?updated=1");
        return;
      }

      const result = await response.json().catch(() => null);
      if (response.status === 401) {
        setProblem({ message: "Your session expired. Sign in again to save your changes.", action: "login" });
      } else if (result?.error?.code === "ACCOUNT_CHANGED") {
        setProblem({ message: "You’re signed in to a different account. Sign back in to the account that started these edits.", action: "switch" });
      } else if (result?.error?.details && Object.keys(result.error.details).length) {
        focusErrors(result.error.details);
      } else if (result?.error?.code === "WEDDING_CHANGED" || response.status === 404) {
        setProblem({ message: "Your wedding is no longer available in this form. Return to the overview to load your current wedding." });
      } else {
        setProblem({ message: "We couldn’t save your changes. Your edits are still here.", retry: true });
      }
    } catch {
      setProblem({ message: "We couldn’t connect. Your edits are still here.", retry: true });
    } finally {
      setSaving(false);
    }
  }

  function field(name: FieldName, label: string, optional = false) {
    const id = "edit-" + name;
    const error = errors[name] || (name === "location" ? errors["location.formattedAddress"] : "");
    const attributes = {
      id, name, value: draft[name], required: !optional,
      className: styles.control,
      "aria-invalid": error ? true as const : undefined,
      "aria-describedby": error ? id + "-error" : undefined,
    };
    return (
      <div className={styles.field}>
        <label htmlFor={id}>{label} {optional && <span className={styles.optional}>Optional</span>}</label>
        {name === "timeZone" ? (
          <select {...attributes} onChange={(event) => updateField(name, event.currentTarget.value)}>
            {timeZones.map((zone) => <option key={zone} value={zone}>
              {zone === defaultWeddingTimeZone ? "India Standard Time" : zone.replaceAll("_", " ")}
            </option>)}
          </select>
        ) : name === "weddingDate" ? (
          <input {...attributes} type="date" onChange={(event) => updateField(name, event.currentTarget.value)} />
        ) : name === "description" ? (
          <textarea {...attributes} {...capitalizeInput(name, draft[name], fieldLimits[name])} rows={4} />
        ) : (
          <input {...attributes} {...capitalizeInput(name, draft[name], fieldLimits[name])} />
        )}
        {error && <p id={id + "-error"} className={styles.fieldError}>{error}</p>}
      </div>
    );
  }

  return (
    <>
      <WorkspaceHeader member={member} onRequestLeave={requestLeave} onNavigateAway={() => { allowNavigation.current = true; }} />
      <main className={styles.shell}>
        <button type="button" className={styles.back} onClick={() => requestLeave(leaveOverview)} disabled={saving}>
          <span aria-hidden="true">←</span> Back to wedding overview
        </button>
        <h1>Edit wedding details</h1>
        <p className={styles.lead}>Update the details shown in your wedding workspace.</p>

        <form className={styles.form} method="post" onSubmit={save} noValidate aria-busy={saving}>
          <fieldset className={styles.fields} disabled={saving}>
            <legend className="sr-only">Wedding details</legend>
            <section aria-labelledby="edit-couple-heading">
              <h2 id="edit-couple-heading">Couple information</h2>
              <div className={styles.pair}>
                {field("brideName", "Bride’s name")}
                {field("groomName", "Groom’s name")}
              </div>
            </section>
            <section aria-labelledby="edit-schedule-heading">
              <h2 id="edit-schedule-heading">Wedding schedule and location</h2>
              <div className={styles.pair}>
                {field("weddingDate", "Wedding date")}
                {field("location", "Wedding city or location")}
              </div>
              <div className={styles.timeZone}>
                {field("timeZone", "Timezone")}
                <p>The countdown uses {draft.timeZone}.</p>
              </div>
            </section>
            <section className={styles.extras} aria-labelledby="edit-personalize-heading">
              <h2 id="edit-personalize-heading">Personalize your workspace</h2>
              {field("title", "Wedding title", true)}
              {field("description", "Short description", true)}
            </section>
          </fieldset>

          <p className={styles.linkNote}>Saving your changes preserves your wedding website address and any existing gallery link.</p>

          {problem && <div className={styles.problem} role="alert">
            <p>{problem.message}</p>
            {problem.action === "login" && <Link href="/login" target="_blank" rel="noopener">Open login in a new tab</Link>}
            {problem.action === "switch" && <Link href="/app" target="_blank" rel="noopener">Open workspace in a new tab to switch accounts</Link>}
          </div>}

          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => requestLeave(leaveOverview)} disabled={saving}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={!dirty || saving}>
              {saving ? "Saving changes…" : problem?.retry ? "Try again" : "Save changes"}
            </button>
          </div>
        </form>
      </main>

      <dialog className={styles.dialog} ref={dialog} aria-labelledby="discard-heading" aria-describedby="discard-message">
        <h2 id="discard-heading">Discard unsaved changes?</h2>
        <p id="discard-message">Your edits will be lost if you leave this page.</p>
        <div className={styles.dialogActions}>
          <button type="button" className={styles.primary} onClick={() => dialog.current?.close()}>Keep editing</button>
          <button type="button" className={styles.secondary} onClick={() => {
            dialog.current?.close();
            pendingLeave.current?.();
          }}>Discard changes</button>
        </div>
      </dialog>
    </>
  );
}
