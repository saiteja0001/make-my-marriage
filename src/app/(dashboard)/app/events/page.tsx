import type { Metadata } from "next";
import Link from "next/link";
import { eventDraftContext, listEvents, type EventDetails } from "@/modules/events/service";
import { eventTypes } from "@/modules/events/validation";
import { eventLocalParts, formatEventDay, formatEventTimeRange, weddingTimeZoneLabel } from "@/modules/events/wedding-time";
import { requireEventWorkspace } from "./_workspace";
import { ArchiveEvent } from "./[eventId]/archive-event";
import styles from "./events.module.css";

export const metadata: Metadata = { title: "Wedding events" };

export default async function EventsPage({ searchParams }: {
  searchParams: Promise<{ view?: string; notice?: string }>;
}) {
  const { user, wedding } = await requireEventWorkspace();
  const { view, notice } = await searchParams;
  const archived = view === "archived";
  const events = (await listEvents(wedding.id, { includeArchived: archived }))
    .filter((event) => Boolean(event.archivedAt) === archived);
  const draft = eventDraftContext(user.id, wedding.id, wedding.timeZone);
  const days = new Map<string, EventDetails[]>();
  for (const event of events) {
    const { date } = eventLocalParts(event.startsAt, wedding.timeZone);
    const dayEvents = days.get(date) ?? [];
    dayEvents.push(event);
    days.set(date, dayEvents);
  }

  return (
    <>
      <header className={styles.pageHeading}>
        <div>
          <h1>Events</h1>
          <p>Plan the schedule for {wedding.title || `${wedding.brideName} & ${wedding.groomName}’s wedding`}.</p>
        </div>
        <Link className={styles.primary} href="/app/events/new">Add event</Link>
      </header>

      {notice === "archived" && <p className={styles.notice} role="status">Event moved to Archived.</p>}

      <section aria-label="Event schedule">
        <div className={styles.scheduleBar}>
          <nav className={styles.views} aria-label="Event views">
            <Link href="/app/events" aria-current={!archived ? "page" : undefined}>Schedule</Link>
            <Link href="/app/events?view=archived" aria-current={archived ? "page" : undefined}>Archived</Link>
          </nav>
          <p className={styles.timeZone}>{weddingTimeZoneLabel(wedding.timeZone)}</p>
        </div>

        {days.size === 0 ? (
          <div className={styles.empty}>
            <h2>{archived ? "No archived events" : "Your schedule is empty"}</h2>
            <p>{archived ? "Archived events will appear here." : "Add your first ceremony or celebration to start planning."}</p>
            {!archived && <Link className={styles.primary} href="/app/events/new">Add your first event</Link>}
          </div>
        ) : (
          <div className={styles.schedule}>
            {Array.from(days, ([day, dayEvents]) => (
              <section key={day} className={styles.day} aria-labelledby={`day-${day}`}>
                <h2 id={`day-${day}`}>
                  <time dateTime={day}>{formatEventDay(dayEvents[0].startsAt, wedding.timeZone, { weekday: "long", month: "long", year: "numeric" })}</time>
                </h2>
                <ul className={styles.eventList}>
                  {dayEvents.map((event) => (
                    <li key={event.id} className={styles.eventCard}>
                      <div className={styles.eventInfo}>
                        {event.type && event.type !== "CUSTOM" && <p className={styles.presetLabel}>{eventTypes[event.type]}</p>}
                        <h3>{event.name}</h3>
                      </div>
                      <dl className={styles.cardDetails}>
                        <div>
                          <dt>Time</dt>
                          <dd>{formatEventTimeRange(event.startsAt, event.endsAt, wedding.timeZone)}</dd>
                        </div>
                        {event.venueName && <div><dt>Venue</dt><dd>{event.venueName}</dd></div>}
                        {event.dressCode && <div><dt>Dress code</dt><dd>{event.dressCode}</dd></div>}
                      </dl>
                      <div className={styles.cardActions}>
                        <Link className={styles.back} href={`/app/events/${event.id}`} aria-label={`View details for ${event.name}`}>View details</Link>
                        {!archived && (
                          <div className={styles.actions}>
                            <Link className={styles.secondary} href={`/app/events/${event.id}/edit`} aria-label={`Edit ${event.name}`}>Edit</Link>
                            <ArchiveEvent id={event.id} name={event.name} draft={draft} />
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
