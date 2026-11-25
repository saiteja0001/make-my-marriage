"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { DiscoveryResult, DiscoverySearch } from "@/modules/vendors/discovery";
import type { DiscoveryMode } from "@/modules/vendors/discovery-validation";
import type { Vendor } from "@/modules/vendors/service";
import { vendorCategories, vendorLimits, type VendorCategory } from "@/modules/vendors/validation";
import { useWorkspaceDraft } from "../../_components/workspace-draft";
import { WorkspaceFormLink } from "../../_components/workspace-form-link";
import { PlaceSummary } from "../place-summary";
import { vendorRequest, VendorRequestError } from "../vendor-http";
import styles from "./discovery.module.css";

function vendorHref(id: string) {
  return "/app/vendors?vendor=" + encodeURIComponent(id);
}

type SaveTarget = { result: DiscoveryResult; category: VendorCategory; mode: DiscoverySearch["mode"] };

function SaveVendor({ target, context, onClose, onSaved }: {
  target: SaveTarget; context: string; onClose: () => void; onSaved: (vendor: Vendor) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<VendorRequestError>();
  const [saved, setSaved] = useState<Vendor>();
  const { requestLeave, allowNavigation } = useWorkspaceDraft(!saved && Boolean(name || notes), busy);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  function close() {
    requestLeave(() => {
      if (problem?.code === "DRAFT_CHANGED" || problem?.code === "DISCOVERY_CHANGED") {
        allowNavigation();
        window.location.reload();
      } else onClose();
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    if (!name.trim()) {
      setProblem(new VendorRequestError(400, "VALIDATION_ERROR", "Enter a vendor label.", { name: "Enter a vendor label." }));
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setProblem(undefined);
    try {
      const id = target.mode === "google" ? { googlePlaceId: target.result.id } : { samplePlaceId: target.result.id };
      const { data } = await vendorRequest<{ data: Vendor }>("/api/vendors/from-place", {
        method: "POST", headers: { "Content-Type": "application/json", "X-Vendor-Draft": context },
        body: JSON.stringify({ ...id, name, notes, category: target.category }),
      });
      setSaved(data);
      onSaved(data);
    } catch (error) {
      setProblem(error instanceof VendorRequestError ? error : new VendorRequestError(0, "", "We couldn’t confirm the save. Try again."));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const reloadNeeded = ["DRAFT_CHANGED", "DISCOVERY_CHANGED"].includes(problem?.code ?? "");
  return <dialog ref={ref} className={styles.drawer} aria-labelledby="save-vendor-title"
    onCancel={(event) => { event.preventDefault(); close(); }}>
    <header className={styles.row}>
      <h2 id="save-vendor-title">Save to My Vendors</h2>
      <button type="button" className={styles.secondary} disabled={busy} onClick={close}>Close</button>
    </header>
    <section className={styles.preview} aria-label="Listing preview"><PlaceSummary place={target.result} mode={target.mode} /></section>
    {saved ? <section className={styles.saved}>
      <p role="status">{saved.archivedAt ? "This vendor is already archived." : `${saved.name} is in My Vendors.`}</p>
      <WorkspaceFormLink className={styles.primary} href={vendorHref(saved.id)}>
        {saved.archivedAt ? "View archived vendor" : "View in My Vendors"}
      </WorkspaceFormLink>
    </section> : <form noValidate onSubmit={save} aria-busy={busy}>
      <fieldset className={styles.saveFields} disabled={busy || reloadNeeded}>
        <legend>Your wedding’s vendor directory</legend>
        <label htmlFor="discovery-label">Vendor label</label>
        <input id="discovery-label" value={name} required maxLength={vendorLimits.name} placeholder="e.g. Wedding photographer"
          onChange={(event) => setName(event.currentTarget.value)} aria-invalid={Boolean(problem?.details?.name)}
          aria-describedby={problem?.details?.name ? "discovery-label-error" : undefined} />
        {problem?.details?.name && <p id="discovery-label-error" className={styles.problem}>{problem.details.name}</p>}
        <label htmlFor="discovery-notes">Notes (optional)</label>
        <textarea id="discovery-notes" rows={4} value={notes} maxLength={vendorLimits.notes}
          onChange={(event) => setNotes(event.currentTarget.value)} aria-invalid={Boolean(problem?.details?.notes)}
          aria-describedby={problem?.details?.notes ? "discovery-notes-error" : undefined} />
        {problem?.details?.notes && <p id="discovery-notes-error" className={styles.problem}>{problem.details.notes}</p>}
      </fieldset>
      {problem && !problem.details && <p role="alert" className={styles.problem}>{problem.message}</p>}
      {problem?.status === 401 && <Link href="/login" target="_blank" rel="noopener" className={styles.secondary}>Open sign-in in a new tab</Link>}
      <footer className={styles.actions}>
        <button type="button" className={styles.secondary} disabled={busy} onClick={close}>{reloadNeeded ? "Reload listings" : "Cancel"}</button>
        <button type="submit" className={styles.primary} disabled={busy || reloadNeeded}>
          {busy ? "Saving…" : problem && !problem.details ? "Retry save" : "Save vendor"}
        </button>
      </footer>
    </form>}
  </dialog>;
}

export function DiscoverVendors({ location: initialLocation, mode, context }: { location: string; mode: DiscoveryMode; context: string }) {
  const [category, setCategory] = useState<VendorCategory>("PHOTOGRAPHER");
  const [location, setLocation] = useState(initialLocation);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<VendorRequestError>();
  const [search, setSearch] = useState<DiscoverySearch & { category: VendorCategory; location: string }>();
  const [target, setTarget] = useState<SaveTarget>();
  const latest = useRef<AbortController | null>(null);

  useEffect(() => () => latest.current?.abort(), []);

  async function load() {
    latest.current?.abort();
    const request = new AbortController();
    latest.current = request;
    setBusy(true);
    setProblem(undefined);
    setSearch(undefined);
    try {
      const query = new URLSearchParams({ category, location: location.trim() });
      const { data } = await vendorRequest<{ data: DiscoverySearch }>("/api/vendor-discovery/search?" + query, {
        signal: request.signal, headers: { "X-Vendor-Draft": context },
      });
      if (!request.signal.aborted) setSearch({ ...data, category, location: location.trim() });
    } catch (error) {
      if (!request.signal.aborted) setProblem(error instanceof VendorRequestError ? error
        : new VendorRequestError(0, "", "We couldn’t load vendor results. Try again."));
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!busy) void load();
  }

  return <main className={styles.page}>
    <header><h1>Discover Vendors</h1><p>Find local wedding businesses and save the ones you want to contact.</p></header>
    {mode === "disabled" ? <section className={styles.empty}>
      <h2>Vendor discovery is unavailable</h2><p>You can still manage your vendors from the directory.</p>
      <WorkspaceFormLink href="/app/vendors" className={styles.secondary}>Open My Vendors</WorkspaceFormLink>
    </section> : <>
      {mode === "sample" && <p className={styles.note}>Sample listings for development. Try Pune to explore the results.</p>}
      <form className={styles.search} aria-label="Find vendors" onSubmit={submit}>
        <div><label htmlFor="discover-category">Vendor category</label>
          <select id="discover-category" value={category} disabled={busy} onChange={(event) => setCategory(event.currentTarget.value as VendorCategory)}>
            {Object.entries(vendorCategories).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select></div>
        <div><label htmlFor="discover-location">City or area</label>
          <input id="discover-location" value={location} onChange={(event) => setLocation(event.currentTarget.value)}
            placeholder="e.g. Pune" disabled={busy} minLength={2} maxLength={200} required /></div>
        <button type="submit" className={styles.primary} disabled={busy}>{busy ? "Searching…" : "Search vendors"}</button>
      </form>
      {busy && <p className={styles.empty} role="status">Loading vendor results…</p>}
      {problem && <section className={styles.empty}>
        <h2>Vendor search couldn’t load</h2><p role="alert">{problem.details?.location ?? problem.message}</p>
        {problem.status === 401 ? <Link className={styles.secondary} href="/login">Sign in</Link>
          : <button type="button" className={styles.secondary} onClick={() => problem.code === "DRAFT_CHANGED" ? window.location.reload() : void load()}>
            {problem.code === "DRAFT_CHANGED" ? "Reload discovery" : "Try again"}
          </button>}
      </section>}
      {search && (search.results.length ? <section aria-labelledby="discovery-results">
        <h2 id="discovery-results" className={styles.resultCount} aria-live="polite">
          {search.results.length} {search.results.length === 1 ? "result" : "results"} in {search.location}
        </h2>
        <ul className={styles.results}>
          {search.results.map((result) => <li key={result.id} className={styles.result}>
            <PlaceSummary place={result} mode={search.mode} />
            <div className={styles.resultActions}>
              {result.saved ? <>
                <span>{result.saved.archived ? "Archived" : "Saved"}</span>
                <WorkspaceFormLink className={styles.secondary} href={vendorHref(result.saved.id)}>
                  {result.saved.archived ? "View archived vendor" : "View in My Vendors"}
                </WorkspaceFormLink>
              </> : <button type="button" className={styles.primary} onClick={() => setTarget({ result, category: search.category, mode: search.mode })}>
                Save to My Vendors
              </button>}
            </div>
          </li>)}
        </ul>
      </section> : <section className={styles.empty}><h2>No vendors found</h2>
        <p>Try a different category or nearby city.</p></section>)}
      {!search && !busy && !problem && <section className={styles.empty}><h2>Find vendors near your wedding</h2>
        <p>Choose a category and city or area to start.</p></section>}
      {target && <SaveVendor target={target} context={context} onClose={() => setTarget(undefined)} onSaved={(vendor) =>
        setSearch((current) => current && { ...current, results: current.results.map((item) => item.id === target.result.id
          ? { ...item, saved: { id: vendor.id, archived: Boolean(vendor.archivedAt) } } : item) })} />}
    </>}
  </main>;
}
