"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { formatInr as formatExpenseAmount, inrInput as expenseAmountInput, parseInr as parseExpenseAmount } from "@/lib/inr";
import type { Expense } from "@/modules/expenses/service";
import { createExpenseSchema, expenseCategories, expenseNotesLimit, expenseTitleLimit } from "@/modules/expenses/validation";
import { useWorkspaceDraft } from "../_components/workspace-draft";
import { expenseRequest, ExpenseRequestError, type ExpenseEvent, type ExpenseVendor } from "./expense-http";
import styles from "./expenses.module.css";

function Field({ name, label, error, children }: { name: string; label: string; error?: string; children: ReactNode }) {
  return <div className={styles.field}>
    <label htmlFor={name}>{label}</label>
    {children}
    {error && <p className={styles.fieldError} id={name + "-error"}>{error}</p>}
  </div>;
}

function errorAttributes(name: string, details: Record<string, string>) {
  const invalid = Boolean(details[name]);
  return { "aria-invalid": invalid, "aria-describedby": invalid ? name + "-error" : undefined };
}

export function ExpenseDrawer({ expense, events, vendors, today, context, onClose, onSaved }: {
  expense?: Expense; events: ExpenseEvent[]; vendors: ExpenseVendor[]; today: string; context: string;
  onClose: (refresh?: boolean) => void; onSaved: (message: string) => void;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const key = useRef<string>(undefined);
  const saving = useRef(false);
  const unconfirmedSave = useRef(false);
  const [initial] = useState(() => ({
    title: expense?.title ?? "", amountPaise: expense ? expenseAmountInput(expense.amountPaise) : "",
    expenseDate: expense?.expenseDate ?? today, category: expense?.category ?? "",
    eventId: expense?.eventId ?? "", vendorId: expense?.vendorId ?? "", notes: expense?.notes ?? "",
  }));
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ExpenseRequestError>();
  const [details, setDetails] = useState<Record<string, string>>({});
  const [unavailableVendors, setUnavailableVendors] = useState<string[]>([]);
  const { requestLeave, allowNavigation } = useWorkspaceDraft(JSON.stringify(initial) !== JSON.stringify(draft), busy);
  const reloadNeeded = problem && ["CONFLICT", "DRAFT_CHANGED", "EXPENSE_ALREADY_CREATED", "EXPENSE_DELETED", "NOT_FOUND"].includes(problem.code);
  const vendorUnavailable = unavailableVendors.includes(draft.vendorId);

  useEffect(() => {
    const panel = dialog.current;
    panel?.showModal();
    return () => panel?.close();
  }, []);

  function change(name: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [name]: value }));
    setDetails((current) => ({ ...current, [name]: "" }));
    if (name === "vendorId" && problem?.code === "VENDOR_UNAVAILABLE") setProblem(undefined);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving.current || reloadNeeded || vendorUnavailable) return;
    const values = createExpenseSchema.safeParse({
      ...draft, amountPaise: parseExpenseAmount(draft.amountPaise), eventId: draft.eventId || null,
      vendorId: draft.vendorId || null, notes: draft.notes || null,
    });
    setProblem(undefined);
    if (!values.success) {
      const errors: Record<string, string> = {};
      for (const issue of values.error.issues) errors[String(issue.path[0])] ??= issue.message;
      if (parseExpenseAmount(draft.amountPaise) === null) errors.amountPaise = "Enter a rupee amount with up to two decimal places.";
      setDetails(errors);
      return;
    }
    setDetails({});
    saving.current = true;
    setBusy(true);
    try {
      const headers = { "Content-Type": "application/json", "X-Expense-Draft": context };
      await expenseRequest(expense ? "/api/expenses/" + expense.id : "/api/expenses", {
        method: expense ? "PATCH" : "POST", body: JSON.stringify(values.data),
        headers: expense ? { ...headers, "If-Match": `"${expense.revision}"` }
          : { ...headers, "Idempotency-Key": key.current ??= crypto.randomUUID() },
      });
      onSaved(expense ? "Expense updated." : "Expense added.");
    } catch (error) {
      const next = error instanceof ExpenseRequestError ? error : new ExpenseRequestError(0, "", "We couldn’t confirm the save. Try again.");
      if (next.status === 0 || next.status >= 500 || (next.status >= 200 && next.status < 300)) {
        unconfirmedSave.current = true;
      }
      const vendorId = values.data.vendorId;
      if (next.code === "VENDOR_UNAVAILABLE" && vendorId) {
        setUnavailableVendors((current) => [...current, vendorId]);
        router.refresh();
      }
      setProblem(next);
      setDetails(next.details ?? {});
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  function close() {
    requestLeave(() => {
      dialog.current?.close();
      if (problem?.code === "DRAFT_CHANGED") {
        allowNavigation();
        window.location.reload();
      } else onClose(Boolean(reloadNeeded) || unconfirmedSave.current);
    });
  }

  return <dialog ref={dialog} className={styles.drawer} aria-labelledby="expense-form-title"
    onCancel={(event) => { event.preventDefault(); close(); }}>
    <header className={styles.dialogHeader}>
      <h2 id="expense-form-title">{expense ? "Edit expense" : "Add expense"}</h2>
      <button type="button" className={styles.secondary} onClick={close} disabled={busy}>Close</button>
    </header>
    <form onSubmit={save} noValidate aria-busy={busy}>
      <fieldset className={styles.formFields} disabled={busy}>
        <legend className="sr-only">Expense details</legend>
        <Field name="title" label="Expense title" error={details.title}>
          <input id="title" value={draft.title} onChange={(event) => change("title", event.currentTarget.value)}
            placeholder="e.g. Venue deposit" required maxLength={expenseTitleLimit} {...errorAttributes("title", details)} />
        </Field>
        <Field name="amountPaise" label="Amount in ₹" error={details.amountPaise}>
          <input id="amountPaise" inputMode="decimal" value={draft.amountPaise} maxLength={20}
            onChange={(event) => change("amountPaise", event.currentTarget.value)} placeholder="0.00" required {...errorAttributes("amountPaise", details)} />
        </Field>
        <Field name="expenseDate" label="Expense date" error={details.expenseDate}>
          <input id="expenseDate" type="date" value={draft.expenseDate} required
            onChange={(event) => change("expenseDate", event.currentTarget.value)} {...errorAttributes("expenseDate", details)} />
        </Field>
        <fieldset className={styles.categories} aria-describedby={details.category ? "category-error" : undefined}>
          <legend>Category</legend>
          {Object.entries(expenseCategories).map(([value, label]) => <label key={value}>
            <input type="radio" name="category" value={value} checked={draft.category === value} required
              onChange={() => change("category", value)} />{label}
          </label>)}
          {details.category && <p className={styles.fieldError} id="category-error">{details.category}</p>}
        </fieldset>
        <Field name="eventId" label="Related wedding event (optional)" error={details.eventId}>
          <select id="eventId" value={draft.eventId} onChange={(event) => change("eventId", event.currentTarget.value)}
            {...errorAttributes("eventId", details)}>
            <option value="">No event</option>
            {events.filter(({ archived, id }) => !archived || expense?.eventId === id).map(({ id, name, archived }) =>
              <option key={id} value={id}>{name}{archived ? " (archived)" : ""}</option>)}
          </select>
        </Field>
        <Field name="vendorId" label="Related vendor (optional)" error={details.vendorId}>
          <select id="vendorId" value={draft.vendorId} onChange={(event) => change("vendorId", event.currentTarget.value)}
            {...errorAttributes("vendorId", details)}>
            <option value="">No vendor</option>
            {vendorUnavailable && <option value={draft.vendorId} disabled>Selected vendor is no longer available</option>}
            {expense?.vendorId && !unavailableVendors.includes(expense.vendorId) && !vendors.some(({ id }) => id === expense.vendorId) &&
              <option value={expense.vendorId}>Unavailable vendor</option>}
            {vendors.filter(({ archived, id }) => !unavailableVendors.includes(id) && (!archived || expense?.vendorId === id)).map(({ id, name, archived }) =>
              <option key={id} value={id}>{name}{archived ? " (archived)" : ""}</option>)}
          </select>
        </Field>
        <Field name="notes" label="Notes (optional)" error={details.notes}>
          <textarea id="notes" rows={3} maxLength={expenseNotesLimit} value={draft.notes}
            onChange={(event) => change("notes", event.currentTarget.value)} {...errorAttributes("notes", details)} />
        </Field>
      </fieldset>
      {(problem || Object.values(details).some(Boolean)) && <p className={styles.error} role="alert">
        {problem?.message ?? "Check the highlighted fields."}
      </p>}
      {problem?.status === 401 && <Link className={styles.secondary} href="/login" target="_blank" rel="noopener">Open sign-in in a new tab</Link>}
      <footer className={styles.formActions}>
        <button type="button" className={styles.secondary} disabled={busy} onClick={close}>{reloadNeeded ? "Back to expenses" : "Cancel"}</button>
        <button type="submit" className={styles.primary} disabled={busy || Boolean(reloadNeeded) || vendorUnavailable}>
          {busy ? "Saving…" : problem && !problem.details ? "Retry save" : expense ? "Save changes" : "Add expense"}
        </button>
      </footer>
    </form>
  </dialog>;
}

export function DeleteExpense({ expense, context, onClose, onDeleted }: {
  expense: Expense; context: string; onClose: (refresh?: boolean) => void; onDeleted: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ExpenseRequestError>();
  useEffect(() => {
    const panel = dialog.current;
    panel?.showModal();
    return () => panel?.close();
  }, []);

  async function remove() {
    setBusy(true);
    setProblem(undefined);
    try {
      await expenseRequest("/api/expenses/" + expense.id, {
        method: "DELETE", headers: { "If-Match": `"${expense.revision}"`, "X-Expense-Draft": context },
      });
      onDeleted();
    } catch (error) {
      if (error instanceof ExpenseRequestError && error.code === "NOT_FOUND") onDeleted();
      else setProblem(error instanceof ExpenseRequestError ? error : new ExpenseRequestError(0, "", "We couldn’t confirm deletion. Try again."));
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (problem?.code === "DRAFT_CHANGED") window.location.reload();
    else onClose(problem?.status === 409);
  }

  return <dialog ref={dialog} className={styles.confirm} aria-labelledby="delete-expense-title" aria-describedby="delete-expense-description"
    onCancel={(event) => { event.preventDefault(); if (!busy) close(); }}>
    <h2 id="delete-expense-title">Delete expense?</h2>
    <p id="delete-expense-description"><strong>{expense.title}</strong> ({formatExpenseAmount(expense.amountPaise)}) will be removed from the ledger.</p>
    {problem && <p className={styles.error} role="alert">{problem.message}</p>}
    {problem?.status === 401 && <Link className={styles.secondary} href="/login" target="_blank" rel="noopener">Open sign-in in a new tab</Link>}
    <footer className={styles.formActions}>
      <button type="button" className={styles.secondary} disabled={busy} onClick={close}>Cancel</button>
      <button type="button" className={styles.danger} disabled={busy || problem?.status === 409} onClick={() => void remove()}>
        {busy ? "Deleting…" : problem ? "Retry deletion" : "Delete expense"}
      </button>
    </footer>
  </dialog>;
}
