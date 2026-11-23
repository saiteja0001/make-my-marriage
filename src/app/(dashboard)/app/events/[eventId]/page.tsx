import type { Metadata } from "next";
import Link from "next/link";
import { eventDraftContext } from "@/modules/events/service";
import { eventTypes } from "@/modules/events/validation";
import { formatEventDay, formatEventTimeRange, weddingTimeZoneLabel } from "@/modules/events/wedding-time";
import { requireWorkspaceEvent } from "../_workspace";
import { ArchiveEvent } from "./archive-event";
import styles from "../events.module.css";

export const metadata: Metadata = { title: "Event details" };

export default async function EventPage({ params, searchParams }: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { user, wedding, event } = await requireWorkspaceEvent((await params).eventId);
  const { notice } = await searchParams;
  const { timeZone } = wedding;
  const details = [
    { label: "Event type", value: event.type && eventTypes[event.type] },
    { label: "Venue", value: event.venueName },
    { label: "Address", value: event.address },
    { label: "Dress code", value: event.dressCode },
    { label: "Description", value: event.description },
  ];

  return (
    <>
      <Link className={styles.back} href={event.archivedAt ? "/app/events?view=archived" : "/app/events"}>Back to events</Link>
      {notice === "created" && <p className={styles.notice} role="status">Event added to your schedule.</p>}
      {notice === "updated" && <p className={styles.notice} role="status">Event details updated.</p>}
      <header className={styles.pageHeading}>
        <div>
          <h1>{event.name}</h1>
          {event.archivedAt && <p>Archived event</p>}
        </div>
        {!event.archivedAt && (
          <div className={styles.actions}>
            <ArchiveEvent id={event.id} name={event.name} draft={eventDraftContext(user.id, wedding.id, timeZone)} />
            <Link className={styles.primary} href={`/app/events/${event.id}/edit`}>Edit event</Link>
          </div>
        )}
      </header>
      <dl className={styles.details}>
        <div>
          <dt>Schedule</dt>
          <dd>
            <time dateTime={event.startsAt}>{formatEventDay(event.startsAt, timeZone, { weekday: "long", month: "long", year: "numeric" })}</time>
            <p>{formatEventTimeRange(event.startsAt, event.endsAt, timeZone)} · {weddingTimeZoneLabel(timeZone)}</p>
          </dd>
        </div>
        {details.map(({ label, value }) => value && <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
    </>
  );
}
