"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { formatEventDay, formatEventTimeRange, weddingTimeZoneLabel } from "@/modules/events/wedding-time";
import type { PublicInvitation } from "@/modules/guests/invitations";
import { rsvpUpdatesChannel } from "@/modules/guests/rsvp-updates";
import { rsvpSchema } from "@/modules/guests/rsvp-validation";
import { formatWeddingDate } from "@/modules/wedding/wedding-date";
import UnavailableInvitation from "./not-found";
import styles from "./invitation.module.css";

type Choices = { status: "ATTENDING" | "NOT_ATTENDING" | ""; count: string };
type Draft = Choices & { revision: number };
type Problem = { message: string; field?: "status" | "attendingCount" };

const emptyChoices: Choices = { status: "", count: "1" };

export function GuestInvitation({ initial, token }: { initial: PublicInvitation; token: string }) {
  const [invitation, setInvitation] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const activeRead = useRef<AbortController | null>(null);
  const writing = useRef(false);
  const endpoint = `/api/public/invitations/${encodeURIComponent(token)}`;
  const { wedding, guest, events } = invitation;
  const choices = draft ?? emptyChoices;
  const showForm = guest.rsvpStatus === "PENDING" || draft !== null;
  const sameResponse = choices.status === guest.rsvpStatus &&
    (choices.status === "NOT_ATTENDING" ? 0 : Number(choices.count)) === guest.attendingCount;
  const needsReview = draft !== null && draft.revision !== guest.revision && !sameResponse;
  const savedResponse = guest.rsvpStatus === "ATTENDING"
    ? guest.attendingCount === 1 ? "You’re attending." : `Your group is attending with ${guest.attendingCount} people.`
    : guest.rsvpStatus === "NOT_ATTENDING" ? "You’ve declined the invitation." : "No response has been saved.";
  const tooMany = choices.status === "ATTENDING" && Number(choices.count) > guest.maxGuests;
  const countError = tooMany ? `Your party limit is ${guest.maxGuests}. Choose a smaller party size.`
    : problem?.field === "attendingCount" ? problem.message : undefined;

  const refresh = useCallback(async () => {
    if (writing.current) return;
    activeRead.current?.abort();
    const read = new AbortController();
    activeRead.current = read;
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal: read.signal });
      const result = await response.json().catch(() => null);
      if (read.signal.aborted) return;
      if (response.status === 404) setUnavailable(true);
      else if (response.ok && result?.data) setInvitation(result.data);
    } catch {
      // The displayed invitation and any in-progress response remain available for retry.
    }
  }, [endpoint]);

  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    channel.current = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(rsvpUpdatesChannel);
    channel.current?.addEventListener("message", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    return () => {
      activeRead.current?.abort();
      channel.current?.close();
      channel.current = null;
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
    };
  }, [refresh]);

  function change(next: Choices) {
    setDraft((current) => ({ ...next, revision: current?.revision ?? guest.revision }));
    setProblem(null);
  }

  function showError(next: Problem) {
    setProblem(next);
    if (next.field) requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>(`#rsvp input[name="${next.field}"]:checked, #rsvp input[name="${next.field}"]`)?.focus();
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (writing.current || needsReview) return;
    setProblem(null);
    const parsed = rsvpSchema.safeParse({
      status: choices.status, attendingCount: choices.status === "NOT_ATTENDING" ? 0 : Number(choices.count),
    });
    if (!parsed.success) {
      if (!choices.status) showError({ field: "status", message: "Choose whether you’ll attend." });
      else showError({ field: "attendingCount", message: "Enter a whole-number party size of at least one." });
      return;
    }
    if (tooMany) {
      showError({ field: "attendingCount", message: countError || "Review your party size." });
      return;
    }

    writing.current = true;
    setSaving(true);
    activeRead.current?.abort();
    let refreshAfter = false;
    try {
      const response = await fetch(endpoint + "/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json", "If-Match": JSON.stringify(String(draft?.revision ?? guest.revision)) },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json().catch(() => null);
      if (response.ok && result?.data) {
        setInvitation((previous) => ({ ...previous, guest: {
          ...previous.guest, rsvpStatus: result.data.status, attendingCount: result.data.attendingCount,
          revision: result.data.revision,
        } }));
        setDraft(null);
        channel.current?.postMessage("updated");
        requestAnimationFrame(() => document.getElementById("rsvp-confirmation")?.focus());
      } else if (response.status === 404) {
        setUnavailable(true);
      } else if (result?.error?.code === "PARTY_SIZE_CHANGED") {
        showError({ field: "attendingCount", message: result.error.message });
        refreshAfter = true;
      } else {
        setProblem({ message: result?.error?.message || "We couldn’t save your RSVP. Your choices are still here." });
        refreshAfter = response.status === 409;
      }
    } catch {
      setProblem({ message: "We couldn’t connect. Your choices are still here." });
    } finally {
      writing.current = false;
      setSaving(false);
      if (refreshAfter) void refresh();
    }
  }

  if (unavailable) return <UnavailableInvitation />;
  const couple = `${wedding.brideName} & ${wedding.groomName}`;
  const monogram = `${Array.from(wedding.brideName)[0] ?? ""}${Array.from(wedding.groomName)[0] ?? ""}`;
  return (
    <main className={styles.invitation}>
      <header className={styles.hero}>
        <div className={styles.monogram} aria-hidden="true">{monogram}</div>
        <h1>{couple}</h1>
        <p className={styles.intro}>Invite you to celebrate their wedding</p>
        <p className={styles.when}><time dateTime={wedding.weddingDate}>{formatWeddingDate(wedding.weddingDate)}</time> · {wedding.location}</p>
        <div className={styles.welcome}>
          <strong>Welcome, {guest.name}</strong>
          <span>Reserved for up to {guest.maxGuests.toLocaleString("en-IN")} {guest.maxGuests === 1 ? "guest" : "guests"}</span>
        </div>
        <a href="#rsvp" className={styles.jump}>{guest.rsvpStatus === "PENDING" ? "Respond to invitation" : "View your RSVP"}</a>
      </header>

      <div className={styles.content}>
        <section className={styles.schedule} aria-labelledby="invitation-events">
          <div className={styles.sectionHeading}>
            <h2 id="invitation-events">Your events</h2>
            {events.length > 0 && <p>{events.length} {events.length === 1 ? "event" : "events"} · {weddingTimeZoneLabel(wedding.timeZone)}</p>}
          </div>
          {events.length ? (
            <ul className={styles.events}>
              {events.map((event, index) => (
                <li className={styles.event} key={`${event.startsAt}-${event.name}-${index}`}>
                  <p className={styles.date}><time dateTime={event.startsAt}>{formatEventDay(event.startsAt, wedding.timeZone,
                    { weekday: "long", month: "long", year: "numeric" })}</time></p>
                  <h3>{event.name}</h3>
                  {event.description && <p className={styles.description}>{event.description}</p>}
                  <dl className={styles.eventInfo}>
                    <div><dt>Time</dt><dd>{formatEventTimeRange(event.startsAt, event.endsAt ?? undefined, wedding.timeZone)}</dd></div>
                    {(event.venueName || event.address) && <div>
                      <dt>Venue</dt><dd>{event.venueName}{event.address && <span>{event.address}</span>}</dd>
                    </div>}
                    {event.dressCode && <div><dt>Dress code</dt><dd>{event.dressCode}</dd></div>}
                  </dl>
                </li>
              ))}
            </ul>
          ) : <p className={styles.noticeCard}>Your hosts will share event details.</p>}
        </section>

        <section id="rsvp" className={styles.rsvp} aria-labelledby="rsvp-title">
          <h2 id="rsvp-title">{showForm ? "Will you be attending?" : "Your RSVP"}</h2>
          {showForm ? (
            <form method="post" onSubmit={submit} aria-busy={saving} noValidate>
              <fieldset className={styles.fields} disabled={saving}>
                <legend className="sr-only">Will you be attending?</legend>
                <div className={styles.options}>
                  <label className={styles.option} data-selected={choices.status === "ATTENDING"}>
                    <input type="radio" name="status" checked={choices.status === "ATTENDING"} value="ATTENDING"
                      aria-describedby={problem?.field === "status" ? "rsvp-status-error" : undefined}
                      onChange={() => change({ ...choices, status: "ATTENDING" })} />
                    <span>Yes, I’ll attend</span>
                  </label>
                  <label className={styles.option} data-selected={choices.status === "NOT_ATTENDING"}>
                    <input type="radio" name="status" checked={choices.status === "NOT_ATTENDING"} value="NOT_ATTENDING"
                      aria-describedby={problem?.field === "status" ? "rsvp-status-error" : undefined}
                      onChange={() => change({ ...choices, status: "NOT_ATTENDING" })} />
                    <span>No, I can’t attend</span>
                  </label>
                </div>
                {problem?.field === "status" && <p className={styles.error} id="rsvp-status-error" role="alert">{problem.message}</p>}
                {choices.status === "ATTENDING" && (
                  <fieldset className={styles.party}>
                    <legend>Number of people attending</legend>
                    <p id="rsvp-count-hint">Choose up to {guest.maxGuests.toLocaleString("en-IN")}, including yourself.</p>
                    {guest.maxGuests <= 8 ? <div className={styles.sizes}>
                      {Array.from({ length: guest.maxGuests }, (_, index) => String(index + 1)).map((count) => (
                        <label key={count} className={styles.size} data-selected={choices.count === count}>
                          <input type="radio" className="sr-only" name="attendingCount" value={count} checked={choices.count === count}
                            aria-describedby={countError ? "rsvp-count-error" : "rsvp-count-hint"} onChange={() => change({ ...choices, count })} />
                          <span>{count}</span>
                        </label>
                      ))}
                    </div> : <input type="number" name="attendingCount" aria-label="Number of people attending" inputMode="numeric"
                      min={1} max={guest.maxGuests} step={1} value={choices.count}
                      aria-describedby={countError ? "rsvp-count-error" : "rsvp-count-hint"} className={styles.count}
                      onChange={(event) => change({ ...choices, count: event.currentTarget.value })} />}
                    {countError && <p className={styles.error} id="rsvp-count-error" role="alert">{countError}</p>}
                  </fieldset>
                )}
              </fieldset>
              {problem && !problem.field && <p role="alert" className={styles.error}>{problem.message}</p>}
              {needsReview && <p role="status" className={styles.error}>The invitation changed. Current response: {savedResponse}</p>}
              <div className={styles.actions}>
                {guest.rsvpStatus !== "PENDING" && <button type="button" disabled={saving} className={styles.secondary}
                  onClick={() => { setDraft(null); setProblem(null); }}>Cancel</button>}
                {needsReview ? <button key="review" type="button" disabled={saving} className={styles.primary} onClick={() => {
                  setDraft((current) => current && { ...current, revision: guest.revision });
                  setProblem(null);
                }}>Keep my choices</button> :
                  <button key="save" type="submit" disabled={saving} className={styles.primary}>
                    {saving ? "Submitting…" : problem && !problem.field ? "Try again"
                      : guest.rsvpStatus === "PENDING" ? "Submit RSVP" : "Save response"}
                  </button>}
              </div>
            </form>
          ) : (
            <div className={styles.confirmation} id="rsvp-confirmation" tabIndex={-1}>
              <p className={styles.saved}>Response saved</p>
              <p role="status">{savedResponse}</p>
              <button className={styles.secondary} type="button" onClick={() => change({
                status: guest.rsvpStatus === "ATTENDING" ? "ATTENDING" : "NOT_ATTENDING",
                count: String(guest.attendingCount || 1),
              })}>Edit response</button>
            </div>
          )}
        </section>
      </div>
      <footer className={styles.footer}>Make My Marriage</footer>
    </main>
  );
}
