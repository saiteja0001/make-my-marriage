"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { formatInr, inrInput, parseInr } from "@/lib/inr";
import type { Vendor } from "@/modules/vendors/service";
import { createVendorSchema, vendorCategories, vendorLimits } from "@/modules/vendors/validation";
import { formatEventDay } from "@/modules/events/wedding-time";
import { useWorkspaceDraft } from "../_components/workspace-draft";
import { vendorEmail, vendorRequest, VendorRequestError, vendorTelephone, type VendorEvent } from "./vendor-http";
import styles from "./vendors.module.css";

function VendorDialog({ heading, children, onClose, busy = false, confirm = false }: {
  heading: string; children: ReactNode; onClose: () => void; busy?: boolean; confirm?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className={confirm ? styles.confirm : styles.drawer} aria-labelledby="vendor-dialog-heading"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className={styles.dialogHeader}>
      <h2 id="vendor-dialog-heading">{heading}</h2>
      {!confirm && <button type="button" className={styles.secondary} onClick={onClose} disabled={busy}>Close</button>}
    </header>
    {children}
  </dialog>;
}

export function VendorForm({ vendor, events, context, onClose, onSaved }: {
  vendor?: Vendor; events: VendorEvent[]; context: string; onClose: (refresh?: boolean) => void; onSaved: (message: string) => void;
}) {
  const [original] = useState(() => ({
    name: vendor?.name ?? "", category: vendor?.category ?? "", contactPerson: vendor?.contactPerson ?? "",
    phone: vendor?.phone ?? "", email: vendor?.email ?? "", address: vendor?.address ?? "",
    website: vendor?.website ?? "", notes: vendor?.notes ?? "", eventIds: [...vendor?.eventIds ?? []].sort(),
    totalAgreedCostPaise: vendor?.totalAgreedCostPaise == null ? "" : inrInput(vendor.totalAgreedCostPaise),
  }));
  const [draft, setDraft] = useState(original);
  const [details, setDetails] = useState<Record<string, string>>({});
  const [error, setError] = useState<VendorRequestError>();
  const [busy, setBusy] = useState(false);
  const requestKey = useRef<string>(undefined);
  const running = useRef(false);
  const unconfirmedSave = useRef(false);
  const { requestLeave, allowNavigation } = useWorkspaceDraft(JSON.stringify(original) !== JSON.stringify(draft), busy);
  const mustReopen = Boolean(error && ["CONFLICT", "DRAFT_CHANGED", "VENDOR_ALREADY_CREATED", "VENDOR_ARCHIVED", "NOT_FOUND"].includes(error.code));

  function change<K extends keyof typeof draft>(name: K, value: (typeof draft)[K]) {
    setDraft((current) => ({ ...current, [name]: value }));
    setDetails((current) => ({ ...current, [name]: "" }));
  }

  function attributes(name: keyof typeof draft) {
    return { id: "vendor-" + name, "aria-invalid": Boolean(details[name]),
      "aria-describedby": details[name] ? "vendor-" + name + "-error" : undefined };
  }

  function field(name: Exclude<keyof typeof draft, "category" | "eventIds" | "notes">, label: string, options?: {
    type?: string; inputMode?: "decimal" | "email" | "tel" | "url"; placeholder?: string; max?: number; autoComplete?: string;
  }) {
    return <div className={styles.field}>
      <label htmlFor={"vendor-" + name}>{label}</label>
      <input {...attributes(name)} value={draft[name]} type={options?.type ?? "text"} inputMode={options?.inputMode}
        placeholder={options?.placeholder} maxLength={options?.max} autoComplete={options?.autoComplete}
        required={name === "name"} onChange={(event) => change(name, event.currentTarget.value)} />
      {details[name] && <p id={"vendor-" + name + "-error"} className={styles.fieldError}>{details[name]}</p>}
    </div>;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (running.current || mustReopen) return;
    setError(undefined);
    const cost = draft.totalAgreedCostPaise.trim();
    const amount = cost ? parseInr(cost) : null;
    const parsed = createVendorSchema.safeParse({ ...draft, totalAgreedCostPaise: amount });
    const issues: Record<string, string> = {};
    if (!parsed.success) for (const issue of parsed.error.issues) issues[String(issue.path[0])] ??= issue.message;
    if (cost && amount === null) issues.totalAgreedCostPaise = "Enter a rupee amount with up to two decimal places.";
    setDetails(issues);
    if (!parsed.success || Object.keys(issues).length) return;
    running.current = true;
    setBusy(true);
    try {
      const headers = { "Content-Type": "application/json", "X-Vendor-Draft": context };
      await vendorRequest(vendor ? "/api/vendors/" + vendor.id : "/api/vendors", {
        method: vendor ? "PATCH" : "POST", body: JSON.stringify(parsed.data),
        headers: vendor ? { ...headers, "If-Match": `"${vendor.revision}"` }
          : { ...headers, "Idempotency-Key": requestKey.current ??= crypto.randomUUID() },
      });
      onSaved(vendor ? "Vendor updated." : "Vendor added.");
    } catch (error) {
      const problem = error instanceof VendorRequestError ? error : new VendorRequestError(0, "", "We couldn’t confirm the save. Try again.");
      if (problem.unconfirmedWrite) unconfirmedSave.current = true;
      setError(problem);
      setDetails(problem.details ?? {});
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  function close() {
    requestLeave(() => {
      if (error?.code === "DRAFT_CHANGED") { allowNavigation(); window.location.reload(); }
      else onClose(mustReopen || unconfirmedSave.current);
    });
  }

  return <VendorDialog heading={vendor ? "Edit vendor" : "Add vendor"} onClose={close} busy={busy}>
    <form onSubmit={submit} noValidate aria-busy={busy}>
      <fieldset className={styles.formFields} disabled={busy}>
        <legend className="sr-only">Vendor information</legend>
        <fieldset className={styles.formGroup}>
          <legend>Essential details</legend>
          {field("name", "Vendor name", { placeholder: "e.g. Pixel Photography", max: vendorLimits.name, autoComplete: "organization" })}
          <div className={styles.field}>
            <label htmlFor="vendor-category">Category</label>
            <select {...attributes("category")} required value={draft.category} onChange={(event) => change("category", event.currentTarget.value)}>
              <option value="">Select a category</option>
              {Object.entries(vendorCategories).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            {details.category && <p id="vendor-category-error" className={styles.fieldError}>{details.category}</p>}
          </div>
        </fieldset>
        <fieldset className={styles.formGroup}>
          <legend>Contact details <span>Optional</span></legend>
          {field("contactPerson", "Contact person", { placeholder: "e.g. Aarav Mehta", max: vendorLimits.contactPerson })}
          {field("phone", "Phone", { type: "tel", inputMode: "tel", placeholder: "+91 98201 44512", max: vendorLimits.phone })}
          {field("email", "Email", { type: "email", inputMode: "email", placeholder: "name@example.com", max: vendorLimits.email })}
          {field("address", "Address", { max: vendorLimits.address })}
          {field("website", "Website", { inputMode: "url", placeholder: "example.com", max: vendorLimits.website })}
        </fieldset>
        <fieldset className={styles.formGroup}>
          <legend>Wedding details <span>Optional</span></legend>
          {field("totalAgreedCostPaise", "Agreed cost in ₹", { inputMode: "decimal", placeholder: "0.00", max: 20 })}
          <fieldset className={styles.eventField} aria-describedby={details.eventIds ? "vendor-eventIds-error" : undefined}>
            <legend>Related events</legend>
            <div className={styles.options}>
              {events.filter(({ id, archived }) => !archived || original.eventIds.includes(id)).map(({ id, name, archived }) =>
                <label key={id}><input type="checkbox" checked={draft.eventIds.includes(id)}
                  onChange={(event) => change("eventIds", event.currentTarget.checked
                    ? [...draft.eventIds, id].sort() : draft.eventIds.filter((value) => value !== id))} />
                  {name}{archived ? " (archived)" : ""}</label>)}
              {!events.some(({ id, archived }) => !archived || original.eventIds.includes(id)) && <p>No wedding events are available.</p>}
            </div>
            {details.eventIds && <p className={styles.fieldError} id="vendor-eventIds-error">{details.eventIds}</p>}
          </fieldset>
          <div className={styles.field}>
            <label htmlFor="vendor-notes">Notes</label>
            <textarea {...attributes("notes")} rows={4} maxLength={vendorLimits.notes} value={draft.notes}
              onChange={(event) => change("notes", event.currentTarget.value)} />
            {details.notes && <p className={styles.fieldError} id="vendor-notes-error">{details.notes}</p>}
          </div>
        </fieldset>
      </fieldset>
      {(error || Object.values(details).some(Boolean)) && <p className={styles.error} role="alert">
        {error?.message ?? "Check the highlighted fields."}
      </p>}
      {error?.status === 401 && <Link href="/login" target="_blank" rel="noopener" className={styles.secondary}>Open sign-in in a new tab</Link>}
      <footer className={styles.actions}>
        <button type="button" className={styles.secondary} disabled={busy} onClick={close}>{mustReopen ? "Back to vendors" : "Cancel"}</button>
        <button type="submit" className={styles.primary} disabled={busy || mustReopen}>
          {busy ? "Saving…" : error && !error.details ? "Retry save" : vendor ? "Save changes" : "Add vendor"}
        </button>
      </footer>
    </form>
  </VendorDialog>;
}

export function VendorDetails({ vendor, eventName, timeZone, onClose, onEdit, onArchive }: {
  vendor: Vendor; eventName: (id: string) => string; timeZone: string; onClose: () => void;
  onEdit: () => void; onArchive: () => void;
}) {
  return <VendorDialog heading={vendor.name} onClose={onClose}>
    <p className={styles.category}>{vendorCategories[vendor.category]}</p>
    {vendor.archivedAt && <p className={styles.notice}>Archived {formatEventDay(vendor.archivedAt, timeZone)}</p>}
    <dl className={styles.details}>
      <div><dt>Contact person</dt><dd>{vendor.contactPerson ?? "—"}</dd></div>
      <div><dt>Phone</dt><dd>{vendor.phone ? <a href={vendorTelephone(vendor.phone)}>{vendor.phone}</a> : "—"}</dd></div>
      <div><dt>Email</dt><dd>{vendor.email ? <a href={vendorEmail(vendor.email)}>{vendor.email}</a> : "—"}</dd></div>
      <div><dt>Address</dt><dd>{vendor.address ?? "—"}</dd></div>
      <div><dt>Website</dt><dd>{vendor.website ?
        <a href={vendor.website} target="_blank" rel="noopener noreferrer">{vendor.website}</a> : "—"}</dd></div>
      <div><dt>Agreed cost</dt><dd>{vendor.totalAgreedCostPaise === null ? "—" : formatInr(vendor.totalAgreedCostPaise)}</dd></div>
      <div><dt>Related events</dt><dd>{vendor.eventIds.map(eventName).join(", ") || "No events assigned"}</dd></div>
      <div><dt>Notes</dt><dd>{vendor.notes ?? "—"}</dd></div>
    </dl>
    {!vendor.archivedAt && <footer className={styles.actions}>
      <button type="button" className={styles.secondary} onClick={onArchive}>Archive vendor</button>
      <button type="button" className={styles.primary} onClick={onEdit}>Edit vendor</button>
    </footer>}
  </VendorDialog>;
}

export function ArchiveVendor({ vendor, context, onClose, onArchived }: {
  vendor: Vendor; context: string; onClose: (refresh?: boolean) => void; onArchived: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<VendorRequestError>();
  const unconfirmedArchive = useRef(false);
  async function archive() {
    setBusy(true);
    setError(undefined);
    try {
      await vendorRequest("/api/vendors/" + vendor.id, {
        method: "DELETE", headers: { "If-Match": `"${vendor.revision}"`, "X-Vendor-Draft": context },
      });
      onArchived();
    } catch (error) {
      const problem = error instanceof VendorRequestError ? error : new VendorRequestError(0, "", "We couldn’t confirm the archive. Try again.");
      if (problem.unconfirmedWrite) unconfirmedArchive.current = true;
      setError(problem);
    } finally { setBusy(false); }
  }
  function close() {
    if (error?.code === "DRAFT_CHANGED") window.location.reload();
    else onClose(error?.status === 409 || error?.status === 404 || unconfirmedArchive.current);
  }

  return <VendorDialog heading="Archive vendor?" onClose={close} busy={busy} confirm>
    <p><strong>{vendor.name}</strong> will move to the Archived view. Their saved details will remain available.</p>
    {error && <p className={styles.error} role="alert">{error.message}</p>}
    {error?.status === 401 && <Link href="/login" target="_blank" rel="noopener" className={styles.secondary}>Open sign-in in a new tab</Link>}
    <footer className={styles.actions}>
      <button type="button" className={styles.secondary} disabled={busy} onClick={close}>Cancel</button>
      <button type="button" className={styles.primary} disabled={busy || error?.status === 409 || error?.status === 404} onClick={() => void archive()}>
        {busy ? "Archiving…" : error ? "Retry archive" : "Archive vendor"}
      </button>
    </footer>
  </VendorDialog>;
}
