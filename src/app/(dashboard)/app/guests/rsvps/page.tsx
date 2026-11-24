import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatEventDay } from "@/modules/events/wedding-time";
import { getGuestOverview, listGuests } from "@/modules/guests/service";
import { guestLimits, guestListSchema, rsvpStatuses, type GuestFilters } from "@/modules/guests/validation";
import { requireGuestWorkspace } from "../_workspace";
import { GuestEvents } from "../guest-events";
import { RsvpRefresh } from "../rsvp-refresh";
import guestStyles from "../guests.module.css";
import styles from "./summary.module.css";

export const metadata: Metadata = { title: "RSVP Summary" };
const summaryPath = "/app/guests/rsvps";

function summaryUrl({ rsvpStatus, search, page }: Partial<GuestFilters>) {
  const query = new URLSearchParams();
  if (rsvpStatus) query.set("rsvpStatus", rsvpStatus);
  if (search) query.set("search", search);
  if (page && page > 1) query.set("page", String(page));
  return query.size ? summaryPath + "?" + query : summaryPath;
}

export default async function RsvpSummaryPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { wedding } = await requireGuestWorkspace();
  const params = await searchParams;
  const parsed = guestListSchema.safeParse({
    page: params.page ?? undefined, rsvpStatus: params.rsvpStatus || undefined, search: params.search || undefined,
  });
  const filters = parsed.success ? parsed.data : guestListSchema.parse({});
  const [summary, { data: groups, pagination }] = await Promise.all([
    getGuestOverview(wedding.id), listGuests(wedding.id, filters),
  ]);
  if (filters.page > Math.max(1, pagination.totalPages)) {
    redirect(summaryUrl({ ...filters, page: Math.max(1, pagination.totalPages) }));
  }
  const responded = summary.attending + summary.declined;
  const tabs = [
    { label: "All responses", rsvpStatus: undefined, count: summary.groups },
    { label: "Attending", rsvpStatus: "ATTENDING", count: summary.attending },
    { label: "Pending", rsvpStatus: "PENDING", count: summary.pending },
    { label: "Not attending", rsvpStatus: "NOT_ATTENDING", count: summary.declined },
  ] as const;
  const totals = [
    { label: "Total groups", value: summary.groups, href: "/app/guests" },
    { label: "Attending groups", value: summary.attending, href: "/app/guests?rsvpStatus=ATTENDING" },
    { label: "Pending groups", value: summary.pending, href: "/app/guests?rsvpStatus=PENDING" },
    { label: "Not attending groups", value: summary.declined, href: "/app/guests?rsvpStatus=NOT_ATTENDING" },
    { label: "People attending", value: summary.peopleAttending },
  ];

  return (
    <>
      <RsvpRefresh />
      <header className={guestStyles.heading}>
        <div>
          <h1>RSVP Summary</h1>
          <p>Track how many guest groups have responded and how many people are attending.</p>
        </div>
        <Link href="/app/guests" className={guestStyles.secondary}>View guest list</Link>
      </header>
      <dl className={styles.totals} aria-label="RSVP totals">
        {totals.map(({ label, value, href }) => (
          <div key={label} className={styles.total}>
            <dt>{href ? <Link href={href}>{label}</Link> : label}</dt>
            <dd>{value.toLocaleString("en-IN")}</dd>
          </div>
        ))}
      </dl>
      {responded === 0 && <div className={styles.empty} role="status">
        <p>{summary.groups ? "No guest groups have responded yet." : "Add a guest group to start collecting RSVPs."}</p>
        {!summary.groups && <Link href="/app/guests" className={guestStyles.textAction}>Open guest list</Link>}
      </div>}

      <section aria-label="Guest responses">
        <div className={styles.controls}>
          <nav aria-label="Filter by RSVP status" className={styles.tabs}>
            {tabs.map(({ label, rsvpStatus, count }) => (
              <Link key={label} href={summaryUrl({ rsvpStatus, search: filters.search })}
                aria-current={filters.rsvpStatus === rsvpStatus ? "page" : undefined}>{label} <span>{count.toLocaleString("en-IN")}</span></Link>
            ))}
          </nav>
          <form method="get" action={summaryPath} className={styles.search} aria-label="Search RSVP responses" key={filters.search ?? ""}>
            {filters.rsvpStatus && <input type="hidden" name="rsvpStatus" value={filters.rsvpStatus} />}
            <label className="sr-only" htmlFor="rsvp-search">Search by guest name, email, or phone</label>
            <input type="search" id="rsvp-search" name="search" defaultValue={filters.search} maxLength={guestLimits.search}
              placeholder="Search guests" className={guestStyles.control} />
            <button type="submit" className={guestStyles.secondary}>Search</button>
          </form>
        </div>
        {filters.search && <Link className={guestStyles.textAction} href={summaryUrl({ rsvpStatus: filters.rsvpStatus })}>Clear search</Link>}
        {groups.length ? <>
          <div className={styles.columns} aria-hidden="true">
            <span>Named contact</span><span>Party size</span><span>RSVP status</span><span>Response date</span><span>Selected events</span>
          </div>
          <ul className={styles.responses}>
            {groups.map((guest) => (
              <li className={styles.response} key={guest.id}>
                <div className={styles.name}>
                  <Link href={`/app/guests/${guest.id}`}>{guest.name}</Link>
                  {(guest.email || guest.phone) && <span>{guest.email || guest.phone}</span>}
                </div>
                <p className={styles.party}>
                  {guest.attendingCount === null ? `Up to ${guest.maxGuests.toLocaleString("en-IN")}`
                    : `${guest.attendingCount.toLocaleString("en-IN")} of ${guest.maxGuests.toLocaleString("en-IN")}`}
                </p>
                <p className={`${guestStyles.status} ${styles.status}`} data-status={guest.rsvpStatus}>{rsvpStatuses[guest.rsvpStatus]}</p>
                <div className={styles.date}>
                  {guest.rsvpUpdatedAt ? <time dateTime={guest.rsvpUpdatedAt}>{formatEventDay(guest.rsvpUpdatedAt, wedding.timeZone, { year: "numeric" })}</time>
                    : "Awaiting response"}
                </div>
                <div className={styles.events}><GuestEvents guest={guest} timeZone={wedding.timeZone} /></div>
              </li>
            ))}
          </ul>
        </> : <p className={styles.empty}>No guest groups match this view.</p>}
      </section>
      {pagination.totalPages > 1 && <nav aria-label="RSVP summary pages" className={styles.pagination}>
        {pagination.page > 1 && <Link className={guestStyles.secondary} href={summaryUrl({ ...filters, page: pagination.page - 1 })}>Previous</Link>}
        <span>Page {pagination.page} of {pagination.totalPages}</span>
        {pagination.page < pagination.totalPages && <Link className={guestStyles.secondary} href={summaryUrl({ ...filters, page: pagination.page + 1 })}>Next</Link>}
      </nav>}
    </>
  );
}
