"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { formatExpenseAmount } from "@/modules/expenses/money";
import type { Expense } from "@/modules/expenses/service";
import { expenseCategories } from "@/modules/expenses/validation";
import { formatWeddingDate } from "@/modules/wedding/wedding-date";
import { DeleteExpense, ExpenseDrawer } from "./expense-drawer";
import { expenseRequest, ExpenseRequestError, type ExpenseEvent, type ExpensePage, type ExpenseSummary } from "./expense-http";
import styles from "./expenses.module.css";

const blankFilters = { category: "", eventId: "", from: "", to: "" };
const columns = ["Expense", "Category", "Event", "Date", "Amount", "Actions"];

export function ExpenseLedger({ events, context, today }: { events: ExpenseEvent[]; context: string; today: string }) {
  const router = useRouter();
  const [filters, setFilters] = useState(blankFilters);
  const [applied, setApplied] = useState(blankFilters);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [list, setList] = useState<ExpensePage>();
  const [summary, setSummary] = useState<ExpenseSummary>();
  const [problem, setProblem] = useState<ExpenseRequestError>();
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [contextChanged, setContextChanged] = useState(false);
  const [filterError, setFilterError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<Expense | "new">();
  const [deleting, setDeleting] = useState<Expense>();
  const filtered = Object.values(applied).some(Boolean);

  useEffect(() => {
    if (contextChanged) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    for (const [field, value] of Object.entries(applied)) if (value) params.set(field, value);
    void expenseRequest<ExpensePage>("/api/expenses?" + params, {
      signal: controller.signal, headers: { "X-Expense-Draft": context },
    }).then((data) => {
      if (!controller.signal.aborted) setList(data);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof ExpenseRequestError && error.code === "DRAFT_CHANGED") setContextChanged(true);
      else setProblem(error instanceof ExpenseRequestError ? error
        : new ExpenseRequestError(0, "", "Expenses couldn’t load. Try again."));
    });
    return () => controller.abort();
  }, [applied, context, contextChanged, page, version]);

  useEffect(() => {
    if (contextChanged) return;
    const controller = new AbortController();
    void expenseRequest<{ data: ExpenseSummary }>("/api/expenses/summary", {
      signal: controller.signal, headers: { "X-Expense-Draft": context },
    }).then(({ data }) => {
      if (!controller.signal.aborted) { setSummary(data); setSummaryFailed(false); }
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof ExpenseRequestError && error.code === "DRAFT_CHANGED") setContextChanged(true);
      else setSummaryFailed(true);
    });
    return () => controller.abort();
  }, [context, contextChanged, version]);

  function refresh(message?: string) {
    setList(undefined);
    setProblem(undefined);
    setSummary(undefined);
    setSummaryFailed(false);
    if (message) setNotice(message);
    setVersion((current) => current + 1);
  }

  function refreshAfterChange(message?: string) {
    // Invalidate the dashboard data stored for browser Back and Forward.
    router.refresh();
    refresh(message);
  }

  function showPage(next: number) {
    if (next === page) return;
    setList(undefined);
    setProblem(undefined);
    setPage(next);
  }

  function apply(next: typeof blankFilters) {
    if (next.from && next.to && next.to < next.from) {
      setFilterError("End date must be on or after the start date.");
      return;
    }
    setFilterError("");
    setList(undefined);
    setProblem(undefined);
    setApplied({ ...next });
    setPage(1);
  }

  function clear() {
    setFilters(blankFilters);
    apply(blankFilters);
  }

  function filter(event: FormEvent) {
    event.preventDefault();
    apply(filters);
  }

  function eventName(id: string | null) {
    if (id === null) return "No event";
    const event = events.find(({ id: eventId }) => eventId === id);
    return event ? event.name + (event.archived ? " (archived)" : "") : "Unavailable event";
  }

  if (contextChanged) return <main className={styles.page}>
    <section className={styles.empty} role="alert">
      <h1>Expenses</h1>
      <p>Your account or wedding changed. Reopen Expenses to continue.</p>
      <button type="button" className={styles.primary} onClick={() => window.location.reload()}>Reopen Expenses</button>
    </section>
  </main>;

  const records = list?.pagination.total ?? 0;
  const maxPage = list ? Math.max(1, Math.ceil(records / list.pagination.limit)) : 1;

  return <main className={styles.page}>
    <header className={styles.heading}>
      <div><h1>Expenses</h1><p>Track what you’ve spent or committed for your wedding.</p></div>
      <button type="button" className={styles.primary} disabled={!list} onClick={() => setForm("new")}>Add expense</button>
    </header>
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    <div className={styles.summary}>
      <section className={styles.total} aria-labelledby="expenses-total">
        <h2 id="expenses-total">Total wedding expenses</h2>
        {summaryFailed ? <div><p>We couldn’t load the total.</p><button type="button" className={styles.secondary} onClick={() => refresh()}>Retry total</button></div>
          : <p className={styles.value}>{summary ? formatExpenseAmount(summary.totalExpensePaise) : "Loading…"}</p>}
      </section>
      <section className={styles.breakdown} aria-labelledby="expenses-breakdown">
        <h2 id="expenses-breakdown">Category breakdown</h2>
        {summary?.byCategory.length ? <ul className={styles.breakdownList}>
          {summary.byCategory.map(({ category, amountPaise }) => <li key={category}>
            <span>{expenseCategories[category]}</span>
            <strong>{formatExpenseAmount(amountPaise)}</strong>
            <progress aria-label={expenseCategories[category] + " share of wedding expenses"} value={amountPaise} max={summary.totalExpensePaise} />
          </li>)}
        </ul> : <p>{summaryFailed ? "Category totals are unavailable." : summary ? "Category totals appear as you add expenses." : "Loading…"}</p>}
      </section>
    </div>
    <form className={styles.filters} aria-label="Filter expenses" onSubmit={filter}>
      <div className={styles.filterField}><label htmlFor="expense-filter-category">Category</label>
        <select id="expense-filter-category" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.currentTarget.value })}>
        <option value="">All categories</option>
        {Object.entries(expenseCategories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></div>
      <div className={styles.filterField}><label htmlFor="expense-filter-event">Event</label>
        <select id="expense-filter-event" value={filters.eventId} onChange={(event) => setFilters({ ...filters, eventId: event.currentTarget.value })}>
        <option value="">All events</option><option value="none">No event</option>
        {events.map(({ id }) => <option key={id} value={id}>{eventName(id)}</option>)}
      </select></div>
      <div className={styles.filterField}><label htmlFor="expense-filter-from">From</label>
        <input id="expense-filter-from" type="date" value={filters.from} onChange={(event) => {
          setFilters({ ...filters, from: event.currentTarget.value }); setFilterError("");
        }} /></div>
      <div className={styles.filterField}><label htmlFor="expense-filter-to">To</label>
        <input id="expense-filter-to" type="date" value={filters.to} aria-invalid={Boolean(filterError)}
        aria-describedby={filterError ? "expense-filter-error" : undefined}
        onChange={(event) => { setFilters({ ...filters, to: event.currentTarget.value }); setFilterError(""); }} /></div>
      <div className={styles.filterActions}>
        <button type="submit" className={styles.secondary}>Apply filters</button>
        {(filtered || Object.values(filters).some(Boolean)) && <button type="button" className={styles.textAction} onClick={clear}>Clear filters</button>}
      </div>
      {filterError && <p id="expense-filter-error" className={styles.error} role="alert">{filterError}</p>}
    </form>
    {filtered && list && <section className={styles.filtered} aria-label="Filtered results">
      <div><h2>Filtered subtotal</h2><p>{records.toLocaleString("en-IN")} {records === 1 ? "expense" : "expenses"}</p></div>
      <strong>{formatExpenseAmount(list.subtotalPaise)}</strong>
    </section>}
    {problem ? <section className={styles.empty}>
      <h2>Expenses couldn’t load</h2><p>{problem.message}</p>
      {problem.status === 401 ? <Link className={styles.primary} href="/login">Sign in</Link>
        : <button type="button" className={styles.primary} onClick={() => refresh()}>Try again</button>}
    </section> : !list ? <p className={styles.empty} role="status">Loading expenses…</p>
      : list.data.length ? <section className={styles.ledger} aria-label="Expense ledger">
        <div className={styles.ledgerHead} aria-hidden="true">{columns.map((label) => <span key={label}>{label}</span>)}</div>
        <ul aria-label="Saved expenses">
          {list.data.map((expense) => <li key={expense.id} className={styles.row}>
            <div className={styles.expenseName}><h3>{expense.title}</h3>{expense.notes && <p>{expense.notes}</p>}</div>
            <span className={styles.category}><span>{expenseCategories[expense.category]}</span></span>
            <span className={styles.event}>{eventName(expense.eventId)}</span>
            <time dateTime={expense.expenseDate} className={styles.date}>{formatWeddingDate(expense.expenseDate)}</time>
            <strong className={styles.amount}>{formatExpenseAmount(expense.amountPaise)}</strong>
            <div className={styles.rowActions}>
              <button className={styles.textAction} type="button" aria-label={`Edit ${expense.title}`} onClick={() => setForm(expense)}>Edit</button>
              <button className={styles.textDanger} type="button" aria-label={`Delete ${expense.title}`} onClick={() => setDeleting(expense)}>Delete</button>
            </div>
          </li>)}
        </ul>
        <footer className={styles.pagination}>
          <p>{records.toLocaleString("en-IN")} {records === 1 ? "expense" : "expenses"}{maxPage > 1 && ` · Page ${page} of ${maxPage}`}</p>
          {maxPage > 1 && <div>
            <button type="button" className={styles.secondary} disabled={page <= 1} onClick={() => showPage(page - 1)}>Previous</button>
            <button type="button" className={styles.secondary} disabled={page >= maxPage} onClick={() => showPage(page + 1)}>Next</button>
          </div>}
        </footer>
      </section> : <section className={styles.empty}>
        <h2>{filtered ? "No expenses match these filters" : "No expenses yet"}</h2>
        <p>{filtered ? "Change the filters to see more expenses." : "Add a wedding expense to start tracking your total."}</p>
        {page > 1 ? <button type="button" className={styles.secondary} onClick={() => showPage(1)}>Back to first page</button>
          : filtered ? <button type="button" className={styles.secondary} onClick={clear}>Clear filters</button>
            : <button type="button" className={styles.primary} onClick={() => setForm("new")}>Add your first expense</button>}
      </section>}
    {form && <ExpenseDrawer key={form === "new" ? "new" : form.id} expense={form === "new" ? undefined : form}
      context={context} events={events} today={today} onClose={(reload) => { setForm(undefined); if (reload) refreshAfterChange(); }}
      onSaved={(message) => { setForm(undefined); refreshAfterChange(message); }} />}
    {deleting && <DeleteExpense expense={deleting} context={context} onClose={(reload) => { setDeleting(undefined); if (reload) refreshAfterChange(); }}
      onDeleted={() => {
        if (list?.data.length === 1 && page > 1) setPage(page - 1);
        setDeleting(undefined);
        refreshAfterChange("Expense deleted.");
      }} />}
  </main>;
}
