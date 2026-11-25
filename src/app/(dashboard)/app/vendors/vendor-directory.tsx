"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { formatInr } from "@/lib/inr";
import type { Vendor } from "@/modules/vendors/service";
import { vendorCategories } from "@/modules/vendors/validation";
import { ArchiveVendor, VendorDetails, VendorForm } from "./vendor-panels";
import { vendorEmail, vendorRequest, VendorRequestError, vendorTelephone, type VendorEvent, type VendorPage } from "./vendor-http";
import styles from "./vendors.module.css";

const emptyFilters = { search: "", category: "" };
const columns = ["Vendor", "Category", "Contact", "Related events", "Agreed cost", "Actions"];
type Status = "active" | "archived";
type Panel = { type: "create" } | { type: "details" | "edit" | "archive"; vendor: Vendor };

export function VendorDirectory({ events, timeZone, context, initialVendor }: {
  events: VendorEvent[]; timeZone: string; context: string; initialVendor?: Vendor;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [status, setStatus] = useState<Status>(initialVendor?.archivedAt ? "archived" : "active");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [list, setList] = useState<VendorPage>();
  const [stats, setStats] = useState<VendorPage["directory"]>();
  const [problem, setProblem] = useState<VendorRequestError>();
  const [notice, setNotice] = useState("");
  const [panel, setPanel] = useState<Panel | undefined>(() => initialVendor ? { type: "details", vendor: initialVendor } : undefined);
  const isFiltered = Boolean(applied.search || applied.category);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(page), status });
    if (applied.search) query.set("search", applied.search);
    if (applied.category) query.set("category", applied.category);
    void vendorRequest<VendorPage>("/api/vendors?" + query, {
      signal: controller.signal, headers: { "X-Vendor-Draft": context },
    }).then((result) => {
      if (!controller.signal.aborted) { setList(result); setStats(result.directory); }
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setProblem(error instanceof VendorRequestError ? error
        : new VendorRequestError(0, "", "We couldn’t load vendors. Try again."));
    });
    return () => controller.abort();
  }, [applied, context, page, status, version]);

  function startLoad() {
    setList(undefined);
    setProblem(undefined);
  }

  function apply(next: typeof emptyFilters) {
    startLoad();
    setApplied({ ...next, search: next.search.trim() });
    setPage(1);
  }

  function changeStatus(next: Status) {
    if (next === status) return;
    startLoad();
    setPage(1);
    setStatus(next);
  }

  function refresh(message?: string) {
    startLoad();
    setVersion((current) => current + 1);
    setNotice(message ?? "");
  }

  function refreshAfterChange(message?: string) {
    router.refresh();
    setStats(undefined);
    refresh(message);
  }

  function showNewVendors() {
    setStatus("active");
    clear();
  }

  function close(refreshNeeded?: boolean) {
    if (refreshNeeded) {
      if (panel?.type === "create") showNewVendors();
      refreshAfterChange();
    }
    setPanel(undefined);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    apply(filters);
  }

  function clear() {
    setFilters(emptyFilters);
    apply(emptyFilters);
  }

  function goTo(next: number) {
    startLoad();
    setPage(next);
  }

  function eventName(id: string) {
    const event = events.find((entry) => entry.id === id);
    return event ? event.name + (event.archived ? " (archived)" : "") : "Unavailable event";
  }

  if (problem?.code === "DRAFT_CHANGED") return <main className={styles.page}>
    <section className={styles.empty} role="alert">
      <h1>My Vendors</h1>
      <p>{problem.message}</p>
      <button type="button" className={styles.primary} onClick={() => window.location.reload()}>Reopen My Vendors</button>
    </section>
  </main>;

  const count = list?.pagination.total ?? 0;
  const lastPage = list ? Math.max(1, Math.ceil(count / list.pagination.limit)) : 1;

  return <main className={styles.page}>
    <header className={styles.heading}>
      <div><h1>My Vendors</h1><p>Keep vendor contacts, event assignments, and agreed costs in one place.</p></div>
      <button type="button" className={styles.primary} disabled={!list} onClick={() => setPanel({ type: "create" })}>Add vendor</button>
    </header>
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {stats && <dl className={styles.summary} aria-label="Vendor directory summary">
      <div><dt>Total agreed cost</dt><dd>{formatInr(stats.totalAgreedCostPaise)}<span>Across active vendors</span></dd></div>
      <div><dt>Events covered</dt><dd>{stats.eventsCovered.toLocaleString("en-IN")}<span>Linked to active vendors</span></dd></div>
      <div><dt>Active vendors</dt><dd>{stats.active.toLocaleString("en-IN")}<span>{stats.archived.toLocaleString("en-IN")} archived</span></dd></div>
    </dl>}
    <div className={styles.toolbar}>
      <form className={styles.filters} aria-label="Search and filter vendors" onSubmit={submit}>
        <div><label htmlFor="vendor-search" className="sr-only">Search vendors</label>
          <input id="vendor-search" type="search" maxLength={120} value={filters.search} placeholder="Search vendors or contacts"
            onChange={(event) => setFilters({ ...filters, search: event.currentTarget.value })} /></div>
        <div><label htmlFor="vendor-filter-category" className="sr-only">Filter by category</label>
          <select id="vendor-filter-category" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.currentTarget.value })}>
            <option value="">All categories</option>
            {Object.entries(vendorCategories).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select></div>
        <div className={styles.filterActions}>
          <button type="submit" className={styles.secondary}>Apply filters</button>
          {(isFiltered || filters.search || filters.category) && <button type="button" className={styles.text} onClick={clear}>Clear filters</button>}
        </div>
      </form>
      <div className={styles.views} role="group" aria-label="Vendor status">
        <button type="button" aria-pressed={status === "active"} onClick={() => changeStatus("active")}>Active</button>
        <button type="button" aria-pressed={status === "archived"} onClick={() => changeStatus("archived")}>Archived</button>
      </div>
    </div>
    {list && <p className={styles.resultCount}>{count.toLocaleString("en-IN")} {status} {count === 1 ? "vendor" : "vendors"}</p>}
    {problem ? <section className={styles.empty}>
      <h2>Vendors couldn’t load</h2><p>{problem.message}</p>
      {problem.status === 401 ? <Link href="/login" className={styles.primary}>Sign in</Link>
        : <button type="button" className={styles.primary} onClick={() => refresh()}>Try again</button>}
    </section> : !list ? <p className={styles.empty} role="status">Loading vendors…</p>
      : list.data.length ? <section className={styles.ledger} aria-label="Vendor directory">
        <div className={styles.tableHeading} aria-hidden="true">{columns.map((label) => <span key={label}>{label}</span>)}</div>
        <ul aria-label="Saved vendors">
          {list.data.map((vendor) => <li key={vendor.id} className={styles.row}>
            <div className={styles.identity}>
              <span className={styles.initial} aria-hidden="true">{Array.from(vendor.name)[0]?.toLocaleUpperCase("en-IN")}</span>
              <h2><button type="button" onClick={() => setPanel({ type: "details", vendor })}>{vendor.name}</button></h2>
            </div>
            <span className={styles.category}>{vendorCategories[vendor.category]}</span>
            <div className={styles.contact}>
              {vendor.contactPerson && <strong>{vendor.contactPerson}</strong>}
              {vendor.phone && <a href={vendorTelephone(vendor.phone)} aria-label={`Call ${vendor.name}`}>{vendor.phone}</a>}
              {vendor.email && <a href={vendorEmail(vendor.email)} aria-label={`Email ${vendor.name}`}>{vendor.email}</a>}
              {!vendor.contactPerson && !vendor.phone && !vendor.email && <span>—</span>}
            </div>
            <div className={styles.events}>{vendor.eventIds.length ? vendor.eventIds.map((eventId) =>
              <span key={eventId}>{eventName(eventId)}</span>) : <small>No events</small>}</div>
            <div className={styles.cost}><span>Agreed cost</span><strong>{vendor.totalAgreedCostPaise === null ? "—" : formatInr(vendor.totalAgreedCostPaise)}</strong></div>
            <div className={styles.rowActions}>
              <button type="button" className={styles.text} aria-label={`View ${vendor.name}`} onClick={() => setPanel({ type: "details", vendor })}>View</button>
              {!vendor.archivedAt && <>
                <button type="button" className={styles.text} aria-label={`Edit ${vendor.name}`} onClick={() => setPanel({ type: "edit", vendor })}>Edit</button>
                <button type="button" className={styles.text} aria-label={`Archive ${vendor.name}`} onClick={() => setPanel({ type: "archive", vendor })}>Archive</button>
              </>}
            </div>
          </li>)}
        </ul>
        {lastPage > 1 && <footer className={styles.pagination}>
          <p>Page {page} of {lastPage}</p>
          <div><button type="button" className={styles.secondary} disabled={page === 1} onClick={() => goTo(page - 1)}>Previous</button>
            <button type="button" className={styles.secondary} disabled={page >= lastPage} onClick={() => goTo(page + 1)}>Next</button></div>
        </footer>}
      </section> : <section className={styles.empty}>
        <h2>{isFiltered ? "No vendors match these filters" : status === "archived" ? "No archived vendors" : "No active vendors yet"}</h2>
        <p>{isFiltered ? "Try another search or category." : status === "archived" ? "Archived vendor details appear here." : "Add a vendor to keep their details and event assignments together."}</p>
        {page > 1 ? <button type="button" className={styles.secondary} onClick={() => goTo(1)}>Back to first page</button>
          : isFiltered ? <button type="button" className={styles.secondary} onClick={clear}>Clear filters</button>
            : status === "active" ? <button type="button" className={styles.primary} onClick={() => setPanel({ type: "create" })}>Add your first vendor</button>
              : <button type="button" className={styles.secondary} onClick={() => changeStatus("active")}>View active vendors</button>}
      </section>}
    {(panel?.type === "create" || panel?.type === "edit") && <VendorForm key={panel.type === "create" ? "new" : panel.vendor.id}
      vendor={panel.type === "edit" ? panel.vendor : undefined} events={events} context={context} onClose={close}
      onSaved={(message) => {
        setPanel(undefined);
        if (panel.type === "create") showNewVendors();
        refreshAfterChange(message);
      }} />}
    {panel?.type === "details" && <VendorDetails vendor={panel.vendor} eventName={eventName} timeZone={timeZone} context={context} onClose={() => close()}
      onEdit={() => setPanel({ type: "edit", vendor: panel.vendor })} onArchive={() => setPanel({ type: "archive", vendor: panel.vendor })} />}
    {panel?.type === "archive" && <ArchiveVendor vendor={panel.vendor} context={context} onClose={close}
      onArchived={() => {
        if (list?.data.length === 1 && page > 1) setPage(page - 1);
        setPanel(undefined);
        refreshAfterChange("Vendor archived.");
      }} />}
  </main>;
}
