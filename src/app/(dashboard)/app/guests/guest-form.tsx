"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatEventDay } from "@/modules/events/wedding-time";
import type { GuestDetails, guestEventOptions } from "@/modules/guests/service";
import { createGuestSchema, guestLimits, rsvpStatuses, type GuestValues } from "@/modules/guests/validation";
import { useWorkspaceDraft } from "../_components/workspace-draft";
import styles from "./guests.module.css";

function initialDraft(guest?: GuestDetails) {
  return {
    name: guest?.name ?? "",
    email: guest?.email ?? "",
    phone: guest?.phone ?? "",
    maxGuests: String(guest?.maxGuests ?? 1),
    notes: guest?.notes ?? "",
    invitedEventIds: guest?.invitedEventIds ?? [],
  };
}

type Draft = ReturnType<typeof initialDraft>;
type Field = Exclude<keyof Draft, "invitedEventIds">;
type FieldErrors = Partial<Record<keyof Draft, string>>;
type Problem = { message: string; action: "login" | "reopen" | "retry" | "new" | "review" | "missing"; href?: string };
type CreateRequest = {
  key: string;
  values?: GuestValues;
  savedCorrections?: Partial<GuestValues>;
  pendingCorrection?: { revision: number; values: Partial<GuestValues> };
};
type GuestSaveResponse = { data?: GuestDetails; error?: { message?: string; details?: FieldErrors } };

function changedFields(values: Partial<GuestValues>, baseline: GuestValues | GuestDetails) {
  return Object.fromEntries((Object.keys(values) as (keyof GuestValues)[]).filter((key) => {
    if (key === "invitedEventIds") {
      const selected = values.invitedEventIds ?? [];
      return selected.length !== baseline.invitedEventIds.length || selected.some((id) => !baseline.invitedEventIds.includes(id));
    }
    return values[key] !== (baseline[key] ?? "");
  }).map((key) => [key, values[key]]));
}

async function saveGuest(
  context: string, body: Partial<GuestValues>, target?: GuestDetails, createKey?: string,
) {
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-Guest-Draft": context };
  if (target) headers["If-Match"] = JSON.stringify(String(target.revision));
  if (createKey) headers["Idempotency-Key"] = createKey;
  const result = await fetch(target ? `/api/guests/${target.id}` : "/api/guests", {
    method: target ? "PATCH" : "POST", headers, body: JSON.stringify(body),
  });
  const response: GuestSaveResponse | null = await result.json().catch(() => null);
  return { result, response };
}

export function GuestForm({ guest, events, timeZone, context, closeUrl, recoveryUrl }: {
  guest?: GuestDetails;
  events: Awaited<ReturnType<typeof guestEventOptions>>;
  timeZone: string;
  context: string;
  closeUrl: string;
  recoveryUrl: string;
}) {
  const panel = useRef<HTMLDialogElement>(null);
  const request = useRef<CreateRequest | null>(null);
  const [initial] = useState(() => initialDraft(guest));
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<Problem>();
  const [saving, setSaving] = useState(false);
  const dismissUrl = problem?.action === "missing" ? "/app/guests" : closeUrl;
  const dirty = (Object.keys(initial) as (keyof Draft)[])
    .some((key) => key === "invitedEventIds"
      ? initial.invitedEventIds.length !== draft.invitedEventIds.length || initial.invitedEventIds.some((id) => !draft.invitedEventIds.includes(id))
      : initial[key] !== draft[key]);
  const { leaveFor, allowNavigation } = useWorkspaceDraft(dirty, saving);

  useEffect(() => {
    const dialog = panel.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const selectable = events.filter(({ id, archivedAt }) => !archivedAt || initial.invitedEventIds.includes(id));
  const unavailable = initial.invitedEventIds.filter((id) => !events.some((event) => event.id === id));

  function setField(field: Field, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  function setEvent(id: string, checked: boolean) {
    setDraft((previous) => ({
      ...previous,
      invitedEventIds: checked ? [...previous.invitedEventIds, id] : previous.invitedEventIds.filter((value) => value !== id),
    }));
    setErrors((previous) => ({ ...previous, invitedEventIds: undefined }));
  }

  function focusErrors(next: FieldErrors) {
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) requestAnimationFrame(() => document.getElementById("guest-" + first)?.focus());
  }

  async function submit(submission: FormEvent<HTMLFormElement>) {
    submission.preventDefault();
    if (saving || problem?.action === "missing") return;
    const startNew = problem?.action === "new";
    const parsed = createGuestSchema.safeParse({ ...draft, maxGuests: draft.maxGuests === "" ? NaN : Number(draft.maxGuests) });
    if (!parsed.success) {
      return focusErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])));
    }
    const values = parsed.data;
    const payload = guest ? changedFields(values, guest) : values;
    if (!Object.keys(payload).length) return setProblem({ message: "Make a change before saving the guest group.", action: "review" });

    let creation: CreateRequest | null = null;
    if (!guest) {
      if (!request.current || startNew) request.current = { key: crypto.randomUUID() };
      creation = request.current;
    }
    const submittedValues = creation ? (creation.values ??= values) : values;
    setProblem(undefined);
    setErrors({});
    setSaving(true);
    try {
      let target = guest;
      let { result, response } = await saveGuest(context, creation ? submittedValues : payload, target, creation?.key);
      if (creation && result.ok && response?.data?.id) {
        const saved = response.data;
        const previous = creation.pendingCorrection;
        if (previous && previous.revision !== saved.revision && !Object.keys(changedFields(previous.values, saved)).length) {
          creation.savedCorrections = { ...creation.savedCorrections, ...previous.values };
          creation.pendingCorrection = undefined;
        }
        const baseline = { ...submittedValues, ...creation.savedCorrections };
        const pending = creation.pendingCorrection;
        const pendingFields = Object.keys(pending?.values ?? {}) as (keyof GuestValues)[];
        const pendingValues = Object.fromEntries(pendingFields.map((field) => [field, values[field]]));
        const corrections = changedFields({ ...changedFields(values, baseline), ...pendingValues }, saved);
        if (pending?.revision === saved.revision) {
          // Advance the revision even if these values match, so the earlier PATCH cannot save later.
          Object.assign(corrections, pendingValues);
        }
        if (Object.keys(corrections).length) {
          const otherChanges = changedFields(baseline, saved);
          if (Object.keys(corrections).some((key) => Object.hasOwn(otherChanges, key))) {
            setProblem({
              message: "The saved group has changes to the same fields. Open the latest version to review your edits.",
              action: "reopen",
              href: `/app/guests?form=${saved.id}`,
            });
            return;
          }
          target = saved;
          creation.pendingCorrection = { revision: saved.revision, values: corrections };
          ({ result, response } = await saveGuest(context, corrections, target));
          if (result.status >= 400 && result.status < 500) creation.pendingCorrection = pending;
        }
      }
      if (result.ok && response?.data?.id) {
        const next = new URL(closeUrl, window.location.origin);
        next.searchParams.set("notice", guest ? "updated" : "created");
        allowNavigation();
        window.location.replace(next);
      } else if (result.status === 401) {
        setProblem({ message: "Your session expired. Sign in again to continue this draft.", action: "login" });
      } else if (creation && !target && result.status === 410) {
        setProblem({ message: response?.error?.message || "This request created a guest group that was deleted.", action: "new" });
      } else if (creation && !target && (result.status === 400 || result.status === 413 ||
        (result.status === 404 && response?.error?.details))) {
        // A rejected create can submit corrected values with the same key.
        creation.values = undefined;
        if (Object.keys(changedFields(values, submittedValues)).length) {
          setProblem({ message: "The original save was rejected. Try again to save your corrected entries.", action: "retry" });
        } else if (response?.error?.details) {
          focusErrors(response.error.details);
        } else {
          setProblem({ message: response?.error?.message || "Review the guest group and try again.", action: "review" });
        }
      } else if (response?.error?.details && Object.keys(response.error.details).length) {
        focusErrors(response.error.details);
      } else if (target && result.status === 404) {
        setProblem({ message: "This guest group is unavailable. Your entries are still here.", action: "missing" });
      } else if (result.status === 409 || result.status === 404) {
        setProblem({
          message: response?.error?.message || "This guest group changed.",
          action: "reopen",
          href: target && !guest ? `/app/guests?form=${target.id}` : undefined,
        });
      } else {
        setProblem({ message: response?.error?.message || "We couldn’t save this guest group. Your entries are still here.", action: "retry" });
      }
    } catch {
      setProblem({ message: "We couldn’t connect. Your entries are still here.", action: "retry" });
    } finally {
      setSaving(false);
    }
  }

  function field(name: Field, label: string, type = "text") {
    const id = `guest-${name}`;
    const optional = name !== "name" && name !== "maxGuests";
    const error = errors[name];
    const props = {
      id, name, value: draft[name], required: !optional, className: styles.control,
      onChange: (change: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setField(name, change.currentTarget.value),
      "aria-invalid": error ? true as const : undefined,
      "aria-describedby": [name === "maxGuests" && "guest-limit-hint", error && id + "-error"].filter(Boolean).join(" ") || undefined,
    };
    return (
      <div className={styles.field}>
        <label htmlFor={id}>{label}{optional && <small>Optional</small>}</label>
        {name === "notes" ? <textarea {...props} rows={3} maxLength={guestLimits.notes} />
          : <input {...props} type={type} maxLength={type === "number" ? undefined : guestLimits[name]}
            min={type === "number" ? 1 : undefined} max={type === "number" ? guestLimits.maxGuests : undefined}
            step={type === "number" ? 1 : undefined} />}
        {name === "maxGuests" && <p className={styles.muted} id="guest-limit-hint">The party limit includes the named guest.</p>}
        {error && <p className={styles.error} id={id + "-error"}>{error}</p>}
      </div>
    );
  }

  return (
    <dialog ref={panel} className={styles.drawer} aria-labelledby="guest-form-title" onCancel={leaveFor(dismissUrl)}>
      <header className={styles.drawerHeading}>
        <div>
          <h2 id="guest-form-title">{guest ? "Edit guest group" : "Add guest group"}</h2>
          {guest && <p className={styles.status} data-status={guest.rsvpStatus}>{rsvpStatuses[guest.rsvpStatus]}</p>}
        </div>
        <Link href={dismissUrl} className={styles.textAction} aria-label="Close guest form" onNavigate={leaveFor(dismissUrl)}>Close</Link>
      </header>
      <form method="post" onSubmit={submit} aria-busy={saving} noValidate>
        <fieldset className={styles.fields} disabled={saving}>
          <legend className="sr-only">Guest group information</legend>
          {field("name", "Named guest’s name")}
          <div className={styles.pair}>{field("email", "Email", "email")}{field("phone", "Phone", "tel")}</div>
          {field("maxGuests", "Party limit", "number")}
          <fieldset className={styles.eventPicker} id="guest-invitedEventIds" tabIndex={-1}
            aria-describedby={errors.invitedEventIds ? "guest-invitedEventIds-error" : undefined}>
            <legend>Wedding events <small>Optional</small></legend>
            {!selectable.length && !unavailable.length && <p className={styles.muted}>Events can be selected once they’re added to the wedding schedule.</p>}
            {selectable.map(({ id, name, startsAt, archivedAt }) => (
              <label key={id} className={styles.eventChoice}>
                <input type="checkbox" checked={draft.invitedEventIds.includes(id)} onChange={(change) => setEvent(id, change.currentTarget.checked)} />
                <span><strong>{name}</strong><small>{formatEventDay(startsAt, timeZone, { year: "numeric" })}{archivedAt ? " · Archived" : ""}</small></span>
              </label>
            ))}
            {unavailable.map((id) => <label key={id} className={styles.eventChoice}>
              <input type="checkbox" checked={draft.invitedEventIds.includes(id)} onChange={(change) => setEvent(id, change.currentTarget.checked)} />
              <span>Unavailable event</span>
            </label>)}
            {errors.invitedEventIds && <p className={styles.error} id="guest-invitedEventIds-error">{errors.invitedEventIds}</p>}
          </fieldset>
          {field("notes", "Organiser notes")}
        </fieldset>
        {problem && <div className={styles.problem} role="alert">
          <p>{problem.message}</p>
          {problem.action === "login" && <Link href="/login" target="_blank" rel="noopener">Open login in a new tab</Link>}
          {problem.action === "reopen" && <Link href={problem.href ?? recoveryUrl} target="_blank" rel="noopener">Open a fresh form in a new tab</Link>}
          {problem.action === "missing" && <Link href="/app/guests" target="_blank" rel="noopener">Open the Guest List in a new tab</Link>}
        </div>}
        <div className={styles.formActions}>
          <Link href={dismissUrl} className={styles.secondary} onNavigate={leaveFor(dismissUrl)}>Cancel</Link>
          <button type="submit" className={styles.primary} disabled={saving || problem?.action === "missing" || Boolean(guest && !dirty)}>
            {saving ? "Saving…" : problem?.action === "retry" ? "Try again" : problem?.action === "new" ? "Add as a new group"
              : guest ? "Save changes" : "Add guest group"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
