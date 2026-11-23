import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getGuest, getGuestOverview, guestDraftContext, guestEventOptions, listGuests } from "@/modules/guests/service";
import { guestIdSchema, guestListSchema, rsvpStatuses, type GuestFilters as FilterValues } from "@/modules/guests/validation";
import { WorkspaceFormLink } from "../_components/workspace-form-link";
import { requireGuestWorkspace } from "./_workspace";
import { GuestEvents } from "./guest-events";
import { GuestFilters } from "./guest-filters";
import { GuestForm } from "./guest-form";
import styles from "./guests.module.css";

export const metadata: Metadata = { title: "Guest List" };

const notices = { created: "Guest group added.", updated: "Guest group updated.", deleted: "Guest group deleted." } as const;

function listUrl(filters: Partial<FilterValues>, extra: Record<string, string> = {}) {
  const query = new URLSearchParams(extra);
  if (filters.page && filters.page > 1) query.set("page", String(filters.page));
  for (const field of ["search", "eventId", "rsvpStatus"] as const) {
    const value = filters[field];
    if (value) query.set(field, value);
  }
  return query.size ? "/app/guests?" + query : "/app/guests";
}

export default async function GuestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { membershipId, wedding } = await requireGuestWorkspace();
  const params = await searchParams;
  const fields = ["page", "search", "eventId", "rsvpStatus"] as const;
  const input = Object.fromEntries(fields.flatMap((key) => typeof params[key] === "string" && params[key] ? [[key, params[key]]] : []));
  const parsed = guestListSchema.safeParse(input);
  const filters = parsed.success ? parsed.data : guestListSchema.parse({});
  const form = typeof params.form === "string" ? params.form : undefined;
  const editing = form !== undefined && form !== "new";
  const id = editing ? guestIdSchema.safeParse(form) : null;
  if (id && !id.success) notFound();
  const [{ data: groups, pagination }, summary, events, guest] = await Promise.all([
    listGuests(wedding.id, filters), getGuestOverview(wedding.id), guestEventOptions(wedding.id),
    id?.success ? getGuest(wedding.id, id.data) : null,
  ]);
  if (editing && !guest) notFound();
  if (pagination.page > Math.max(1, pagination.totalPages)) {
    redirect(listUrl({ ...filters, page: Math.max(1, pagination.totalPages) }, form ? { form } : {}));
  }
  const currentUrl = listUrl(filters);
  const newUrl = listUrl(filters, { form: "new" });
  const closeUrl = guest && params.from === "details" ? `/app/guests/${guest.id}` : currentUrl;
  const filtered = Boolean(filters.search || filters.eventId || filters.rsvpStatus);
  const notice = typeof params.notice === "string" && Object.hasOwn(notices, params.notice)
    ? notices[params.notice as keyof typeof notices] : null;
  const percent = summary.groups ? Math.round(100 * summary.attending / summary.groups) : 0;
  const groupsLabel = pagination.total === 1 ? "guest group" : "guest groups";

  return (
    <>
      <header className={`${styles.heading} ${styles.listHeading}`}>
        <div>
          <h1>Guest List</h1>
          <p>Organise guest groups, set party limits, and select wedding events.</p>
        </div>
        <WorkspaceFormLink href={newUrl} className={styles.primary}>Add guest group</WorkspaceFormLink>
      </header>
      {notice && <p role="status" className={styles.notice}>{notice}</p>}

      <dl className={styles.summary} aria-label="Guest list summary">
        <div className={styles.summaryCard}><dt>Guest groups</dt><dd className={styles.number}>{summary.groups.toLocaleString("en-IN")}</dd></div>
        <div className={styles.summaryCard}><dt>Total party capacity</dt><dd className={styles.number}>{summary.capacity.toLocaleString("en-IN")}</dd></div>
        <div className={styles.summaryCard}>
          <dt>RSVP breakdown</dt>
          <dd className={styles.rsvpSummary}>
            <span>{summary.pending} Pending</span><span>{summary.attending} Attending</span><span>{summary.declined} Not attending</span>
            <progress aria-label="Share of guest groups attending" max={100} value={percent} />
            <span className={styles.rate}>{percent}% attending</span>
          </dd>
        </div>
      </dl>

      <GuestFilters key={currentUrl} filters={filters} events={events} timeZone={wedding.timeZone}
        eventClearUrl={listUrl({ ...filters, page: 1, eventId: undefined })}
        rsvpClearUrl={listUrl({ ...filters, page: 1, rsvpStatus: undefined })} />

      {groups.length ? (
        <section className={styles.list} aria-label="Guest groups">
          <div className={styles.columns} aria-hidden="true">
            <span>Named contact</span><span>Contact info</span><span>Party limit</span><span>Selected events</span><span>RSVP status</span><span>Actions</span>
          </div>
          <ul className={styles.groups}>
            {groups.map((group) => {
              const initials = group.name.split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0]?.toUpperCase()).join("");
              return (
                <li key={group.id} className={styles.row}>
                  <div className={styles.name}>
                    <span className={styles.initials} aria-hidden="true">{initials}</span>
                    <h2><Link href={`/app/guests/${group.id}`}>{group.name}</Link></h2>
                  </div>
                  <div className={styles.contact}>
                    {group.email && <span>{group.email}</span>}
                    {group.phone && <span>{group.phone}</span>}
                    {!group.email && !group.phone && <span className={styles.muted}>No contact details</span>}
                  </div>
                  <p className={styles.party}>Up to {group.maxGuests.toLocaleString("en-IN")} {group.maxGuests === 1 ? "guest" : "guests"}
                    <small>Includes the named guest</small>
                  </p>
                  <div className={styles.selectedEvents}><GuestEvents guest={group} timeZone={wedding.timeZone} /></div>
                  <p className={styles.status} data-status={group.rsvpStatus}>{rsvpStatuses[group.rsvpStatus]}</p>
                  <div className={styles.rowActions}>
                    <Link href={`/app/guests/${group.id}`} className={styles.textAction} aria-label={`View details for ${group.name}`}>View details</Link>
                    <WorkspaceFormLink href={listUrl(filters, { form: group.id })} className={styles.secondary} aria-label={`Edit ${group.name}`}>Edit</WorkspaceFormLink>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <section className={styles.empty} aria-label="Empty guest list">
          <h2>{filtered ? "No guest groups match your filters" : "Your guest list is empty"}</h2>
          <p>{filtered ? "Try a different search or clear your filters." : "Add a guest group to select the events they can attend."}</p>
          {filtered ? <Link href="/app/guests" className={styles.secondary}>Clear all filters</Link>
            : <WorkspaceFormLink href={newUrl} className={styles.primary}>Add your first guest group</WorkspaceFormLink>}
        </section>
      )}

      {pagination.totalPages > 1 && <nav className={styles.pagination} aria-label="Guest list pages">
        {pagination.page > 1 && <Link href={listUrl({ ...filters, page: pagination.page - 1 })} className={styles.secondary}>Previous</Link>}
        <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total.toLocaleString("en-IN")} {groupsLabel}</span>
        {pagination.page < pagination.totalPages && <Link href={listUrl({ ...filters, page: pagination.page + 1 })} className={styles.secondary}>Next</Link>}
      </nav>}

      {form && <GuestForm key={form} guest={guest ?? undefined} events={events} timeZone={wedding.timeZone}
        context={guestDraftContext(membershipId, wedding.id)} closeUrl={closeUrl}
        recoveryUrl={listUrl(filters, { form, ...(params.from === "details" && { from: "details" }) })} />}
    </>
  );
}
