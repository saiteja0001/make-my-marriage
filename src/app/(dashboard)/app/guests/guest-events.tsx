import { formatEventDay } from "@/modules/events/wedding-time";
import type { GuestDetails } from "@/modules/guests/service";
import styles from "./guests.module.css";

export function GuestEvents({ guest, timeZone }: { guest: GuestDetails; timeZone: string }) {
  if (!guest.invitedEventIds.length) return <span className={styles.muted}>No events selected</span>;
  const events = new Map(guest.invitedEvents.map((event) => [event.id, event]));
  return (
    <ul aria-label="Selected events" className={styles.eventTags}>
      {guest.invitedEventIds.map((id) => {
        const event = events.get(id);
        return <li className={styles.eventTag} key={id} data-archived={Boolean(event?.archivedAt || !event)}>
          {event ? <>{event.name} (<time dateTime={event.startsAt}>{formatEventDay(event.startsAt, timeZone)}</time>){event.archivedAt && " · Archived"}</>
            : "Unavailable event"}
        </li>;
      })}
    </ul>
  );
}
