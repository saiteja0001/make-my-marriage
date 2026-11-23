"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import type { EventDetails } from "@/modules/events/service";
import { createEventSchema, eventFieldLimits, eventTypes, type EventType } from "@/modules/events/validation";
import { eventLocalParts, eventTimeOptions, formatEventDay, formatEventTimeRange, weddingTimeZoneLabel } from "@/modules/events/wedding-time";
import styles from "./events.module.css";

type FieldErrors = Record<string, string>;
type Problem = { message: string; action?: "login" | "reload" | "retry" };

function initialDraft(timeZone: string, event?: EventDetails) {
  const start = event && eventLocalParts(event.startsAt, timeZone);
  const end = event?.endsAt && eventLocalParts(event.endsAt, timeZone);
  return {
    name: event?.name ?? "",
    type: event?.type ?? null,
    startDate: start?.date || "",
    startTime: start?.time || "",
    startOccurrence: event?.startsAt ?? "",
    endDate: end ? end.date : "",
    endTime: end ? end.time : "",
    endOccurrence: event?.endsAt ?? "",
    venueName: event?.venueName ?? "",
    address: event?.address ?? "",
    description: event?.description ?? "",
    dressCode: event?.dressCode ?? "",
  };
}

type Draft = ReturnType<typeof initialDraft>;
type OccurrenceField = "startOccurrence" | "endOccurrence";
type InputField = Exclude<keyof Draft, "type" | OccurrenceField>;
type TimeOptions = ReturnType<typeof eventTimeOptions>;
const textFields = ["name", "venueName", "address", "description", "dressCode"] as const;

function selectedInstant(options: TimeOptions, selected: string) {
  if (options.length === 1) return options[0].instant;
  return options.find(({ instant }) => instant === selected)?.instant ?? null;
}

function displayErrors(errors: FieldErrors) {
  const { startsAt, endsAt, ...other } = errors;
  return { ...other, ...(startsAt && { startTime: startsAt }), ...(endsAt && { endTime: endsAt }) };
}

export function EventForm({ event, timeZone, context }: { event?: EventDetails; timeZone: string; context: string }) {
  const [initial] = useState(() => initialDraft(timeZone, event));
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<Problem>();
  const [saving, setSaving] = useState(false);
  const request = useRef<{ body: string; key: string } | null>(null);
  const clean = Object.keys(initial).every((field) => draft[field as keyof Draft] === initial[field as keyof Draft]);
  const eventUrl = event ? `/app/events/${event.id}` : "/app/events";
  const endDate = draft.endDate || draft.startDate;
  const startOptions = draft.startDate && draft.startTime
    ? eventTimeOptions(draft.startDate, draft.startTime, timeZone, event?.startsAt)
    : [];
  const endOptions = endDate && draft.endTime
    ? eventTimeOptions(endDate, draft.endTime, timeZone, event?.endsAt)
    : [];
  const start = selectedInstant(startOptions, draft.startOccurrence);
  const end = selectedInstant(endOptions, draft.endOccurrence);

  function setField(field: InputField | OccurrenceField, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      const next = { ...previous, [field]: "" };
      if (["startDate", "startTime", "startOccurrence", "endDate", "endOccurrence"].includes(field)) {
        next.endTime = "";
      }
      if (["startDate", "startTime"].includes(field)) next.startOccurrence = "";
      if (["startDate", "endDate", "endTime"].includes(field)) next.endOccurrence = "";
      if (field === "startDate") next.startTime = "";
      return next;
    });
  }

  function choosePreset(preset: EventType) {
    setDraft((previous) => {
      const type = previous.type === preset ? null : preset;
      const oldPresetName = previous.type && previous.type !== "CUSTOM" ? eventTypes[previous.type] : "";
      const name = type && type !== "CUSTOM" && (!previous.name.trim() || previous.name === oldPresetName)
        ? eventTypes[type]
        : previous.name;
      return { ...previous, name, type };
    });
    setErrors((previous) => ({ ...previous, type: "", name: "" }));
  }

  function focusErrors(next: FieldErrors) {
    setErrors(next);
    const field = Object.keys(next)[0];
    if (field) requestAnimationFrame(() => document.getElementById("event-" + field)?.focus());
  }

  async function submit(submission: FormEvent<HTMLFormElement>) {
    submission.preventDefault();
    if (saving) return;
    setProblem(undefined);

    const next: FieldErrors = {};
    if (!draft.name.trim()) next.name = "Enter an event name.";
    if (!draft.startDate) next.startDate = "Choose a start date.";
    if (!draft.startTime) next.startTime = "Enter a start time.";
    else if (startOptions.length > 1 && !start) next.startOccurrence = "Choose which occurrence of the start time to use.";
    else if (draft.startDate && !start) next.startTime = "This time isn’t available in the wedding timezone.";
    if (draft.endDate && !draft.endTime) next.endTime = "Enter an end time or clear the end date.";
    else if (endOptions.length > 1 && !end) next.endOccurrence = "Choose which occurrence of the end time to use.";
    else if (draft.endTime && endDate && !end) {
      next.endTime = "This time isn’t available in the wedding timezone.";
    }
    if (Object.keys(next).length) return focusErrors(next);

    const parsed = createEventSchema.safeParse({
      ...Object.fromEntries(textFields.map((field) => [field, draft[field]])),
      type: draft.type,
      startsAt: start,
      endsAt: end,
    });
    if (!parsed.success) {
      return focusErrors(displayErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message]))));
    }

    const payload = event ? Object.fromEntries(Object.entries(parsed.data).filter(([field, value]) => {
      const previous = event[field as keyof EventDetails];
      return value !== (previous ?? (field === "endsAt" || field === "type" ? null : ""));
    })) : parsed.data;
    if (Object.keys(payload).length === 0) return setProblem({ message: "Make a change before saving the event." });

    const body = JSON.stringify(payload);
    const headers: Record<string, string> = { "Content-Type": "application/json", "X-Event-Draft": context };
    if (event) {
      headers["If-Match"] = JSON.stringify(String(event.revision));
    } else {
      if (request.current?.body !== body) request.current = { body, key: crypto.randomUUID() };
      headers["Idempotency-Key"] = request.current.key;
    }

    setErrors({});
    setSaving(true);
    try {
      const response = await fetch(event ? `/api/events/${event.id}` : "/api/events", {
        method: event ? "PATCH" : "POST", headers, body,
      });
      const result = await response.json().catch(() => null);
      if (response.ok && result?.data?.id) {
        window.location.replace(`/app/events/${result.data.id}?notice=${event ? "updated" : "created"}`);
      } else if (response.status === 401) {
        setProblem({ message: "Your session expired. Sign in again to keep working on this event.", action: "login" });
      } else if (response.status === 409 || response.status === 404) {
        setProblem({ message: result?.error?.message || "This event is no longer available.", action: "reload" });
      } else if (result?.error?.details && Object.keys(result.error.details).length) {
        focusErrors(displayErrors(result.error.details));
      } else {
        setProblem({ message: result?.error?.message || "We couldn’t save this event. Your entries are still here.", action: "retry" });
      }
    } catch {
      setProblem({ message: "We couldn’t connect. Your entries are still here.", action: "retry" });
    } finally {
      setSaving(false);
    }
  }

  function field(name: InputField, label: string, type = "text", required = false) {
    const id = "event-" + name;
    const error = errors[name];
    const props = {
      id, name, required, value: draft[name], className: styles.control,
      maxLength: eventFieldLimits[name as keyof typeof eventFieldLimits],
      onChange: (input: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setField(name, input.currentTarget.value),
      "aria-invalid": error ? true as const : undefined,
      "aria-describedby": error ? id + "-error" : undefined,
    };

    return (
      <div className={styles.field}>
        <label htmlFor={id}>{label} {required ? <span aria-hidden="true">*</span> : <small>Optional</small>}</label>
        {name === "description" ? <textarea {...props} rows={4} /> : <input {...props} type={type} />}
        {error && <p id={id + "-error"} className={styles.error}>{error}</p>}
      </div>
    );
  }

  function occurrenceField(name: OccurrenceField, label: string, options: TimeOptions, selected: string | null) {
    if (options.length < 2) return null;
    const id = "event-" + name;
    const error = errors[name];
    return (
      <div className={styles.field}>
        <label htmlFor={id}>{label}</label>
        <select
          id={id} className={styles.control} value={selected ?? ""}
          onChange={(input) => setField(name, input.currentTarget.value)}
          aria-invalid={error ? true : undefined} aria-describedby={error ? id + "-error" : undefined}
          required
        >
          <option value="" disabled>Choose an occurrence</option>
          {options.map(({ instant, offset }, index) => (
            <option key={instant} value={instant}>{index === 0 ? "Earlier" : "Later"} · {offset}</option>
          ))}
        </select>
        {error && <p id={id + "-error"} className={styles.error}>{error}</p>}
      </div>
    );
  }

  return (
    <>
      <Link href="/app/events" className={styles.back}>Back to events</Link>
      <header className={styles.pageHeading}>
        <h1>{event ? "Edit wedding event" : "Create wedding event"}</h1>
        <p className={styles.timeZone}>{weddingTimeZoneLabel(timeZone)}</p>
      </header>
      <form method="post" noValidate onSubmit={submit} aria-busy={saving}>
        <fieldset className={styles.presets} disabled={saving}>
          <legend>Event type <small>Optional</small></legend>
          <div className={styles.presetButtons}>
            {Object.entries(eventTypes).map(([value, label]) => (
              <button key={value} type="button" id={value === "ROKA" ? "event-type" : undefined}
                aria-pressed={draft.type === value} onClick={() => choosePreset(value as EventType)}>{label}</button>
            ))}
          </div>
          {errors.type && <p className={styles.error}>{errors.type}</p>}
        </fieldset>
        <div className={styles.formLayout}>
          <div className={styles.formFields}>
            <fieldset disabled={saving} className={styles.formSection}>
              <legend>Event schedule</legend>
              {field("name", "Event name", "text", true)}
              <div className={styles.pair}>{field("startDate", "Start date", "date", true)}{field("startTime", "Start time", "time", true)}</div>
              {occurrenceField("startOccurrence", "Start time occurrence", startOptions, start)}
              <div className={styles.pair}>{field("endDate", "End date", "date")}{field("endTime", "End time", "time")}</div>
              {occurrenceField("endOccurrence", "End time occurrence", endOptions, end)}
              <p className={styles.hint}>Leave the end date blank to use the start date. For an event that ends after midnight, choose the next day.</p>
            </fieldset>
            <fieldset disabled={saving} className={styles.formSection}>
              <legend>Venue and event details</legend>
              {field("venueName", "Venue name")}
              {field("address", "Venue address")}
              {field("dressCode", "Dress code")}
              {field("description", "Description")}
            </fieldset>
            {problem && <div className={styles.problem} role="alert">
              <p>{problem.message}</p>
              {problem.action === "login" && <Link href="/login" target="_blank" rel="noopener">Open login in a new tab</Link>}
              {problem.action === "reload" && <Link href={eventUrl} target="_blank" rel="noopener">Open the current schedule in a new tab</Link>}
            </div>}
            <div className={styles.formActions}>
              <Link className={styles.secondary} href={eventUrl}>Cancel</Link>
              <button type="submit" className={styles.primary} disabled={saving || Boolean(event && clean)}>
                {saving ? "Saving…" : problem?.action === "retry" ? "Try again" : event ? "Save changes" : "Create event"}
              </button>
            </div>
          </div>
          <aside className={styles.preview} aria-label="Event preview">
            <div className={styles.previewPhoto}>
              <Image
                src="/homepage/ceremony.webp" alt="" fill sizes="(max-width: 49rem) 88vw, 320px"
              />
              <div>
                <p>Event preview</p>
                <h2>{draft.name.trim() || "Your event"}</h2>
              </div>
            </div>
            {(start || draft.venueName.trim() || draft.dressCode.trim()) && <div className={styles.previewDetails}>
              {start && <p><strong>{formatEventDay(start, timeZone)}</strong> · {formatEventTimeRange(start, end ?? undefined, timeZone)}</p>}
              {draft.venueName.trim() && <p>{draft.venueName}</p>}
              {draft.dressCode.trim() && <p>{draft.dressCode}</p>}
            </div>}
          </aside>
        </div>
      </form>
    </>
  );
}
