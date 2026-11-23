"use client";

import Link from "next/link";
import { useState } from "react";
import { formatEventDay } from "@/modules/events/wedding-time";
import type { guestEventOptions } from "@/modules/guests/service";
import { guestLimits, rsvpStatuses, type GuestFilters as FilterValues } from "@/modules/guests/validation";
import styles from "./guests.module.css";

export function GuestFilters({ filters, events, timeZone, eventClearUrl, rsvpClearUrl }: {
  filters: FilterValues;
  events: Awaited<ReturnType<typeof guestEventOptions>>;
  timeZone: string;
  eventClearUrl: string;
  rsvpClearUrl: string;
}) {
  const event = events.find(({ id }) => id === filters.eventId);
  const activeFilters = Number(Boolean(filters.eventId)) + Number(Boolean(filters.rsvpStatus));
  const [expanded, setExpanded] = useState(false);

  return (
    <form method="get" action="/app/guests" className={styles.filters} aria-label="Search and filter guest groups">
      <div className={styles.searchRow}>
        <label className={styles.search}>
          <span className="sr-only">Search by name, email, or phone</span>
          <input name="search" type="search" maxLength={guestLimits.search} placeholder="Search guests" defaultValue={filters.search} />
        </label>
        <button type="submit" className={styles.secondary}>Search</button>
        <button type="button" className={styles.filterToggle + " " + styles.secondary} aria-expanded={expanded} aria-controls="guest-filter-controls"
          onClick={() => setExpanded((open) => !open)}>Filters{activeFilters > 0 && ` (${activeFilters})`}</button>
      </div>
      <div id="guest-filter-controls" className={styles.filterControls} data-open={expanded}>
        <label>Event
          <select name="eventId" defaultValue={filters.eventId || ""}>
            <option value="">All events</option>
            {events.map(({ id, name, startsAt, archivedAt }) => (
              <option key={id} value={id}>{name} · {formatEventDay(startsAt, timeZone)}{archivedAt ? " (archived)" : ""}</option>
            ))}
            {filters.eventId && !event && <option value={filters.eventId}>Unavailable event</option>}
          </select>
        </label>
        <label>RSVP status
          <select name="rsvpStatus" defaultValue={filters.rsvpStatus || ""}>
            <option value="">All statuses</option>
            {Object.entries(rsvpStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="submit" className={styles.secondary}>Apply filters</button>
      </div>
      {(activeFilters > 0 || filters.search) && <div className={styles.activeFilters}>
        {filters.eventId && <Link href={eventClearUrl} className={styles.filterTag} aria-label="Clear event filter">{event?.name || "Unavailable event"} <span aria-hidden="true">×</span></Link>}
        {filters.rsvpStatus && <Link href={rsvpClearUrl} className={styles.filterTag} aria-label="Clear RSVP status filter">{rsvpStatuses[filters.rsvpStatus]} <span aria-hidden="true">×</span></Link>}
        <Link href="/app/guests" className={styles.textAction}>Clear all</Link>
      </div>}
    </form>
  );
}
