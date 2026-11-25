import "server-only";
import { createHash } from "node:crypto";
import { Types, type ClientSession, type QueryFilter } from "mongoose";
import { lockActiveEventReferences } from "@/modules/events/service";
import { lockActiveVendorReference } from "@/modules/vendors/service";
import { connectDatabase } from "@/server/db/mongoose";
import { ExpenseCreationRequest, prepareExpenseStorage, WeddingExpense, type ExpenseCreationRecord, type ExpenseRecord } from "./model";
import type { ExpenseCategory, ExpenseChanges, ExpenseFilters, ExpenseValues } from "./validation";

export class ExpenseProblem extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, string>) {
    super(message);
  }
}

export function expenseDraftContext(weddingId: string, membershipId: string) {
  return createHash("sha256").update(JSON.stringify([weddingId, membershipId])).digest("hex");
}

function expenseView(expense: ExpenseRecord) {
  return {
    id: expense._id.toString(), title: expense.title, amountPaise: expense.amountPaise,
    currency: expense.currency, expenseDate: expense.expenseDate, category: expense.category,
    eventId: expense.eventId?.toString() ?? null, vendorId: expense.vendorId?.toString() ?? null,
    notes: expense.notes ?? null, revision: expense.__v ?? 0,
  };
}

export type Expense = ReturnType<typeof expenseView>;

function eventUnavailable() {
  const message = "Choose an active event from your wedding.";
  return new ExpenseProblem(404, "EVENT_UNAVAILABLE", message, { eventId: message });
}

function vendorUnavailable() {
  const message = "Choose an active vendor from your wedding.";
  return new ExpenseProblem(404, "VENDOR_UNAVAILABLE", message, { vendorId: message });
}

function conflict() {
  return new ExpenseProblem(409, "CONFLICT", "This expense changed. Reopen it to review the saved amounts.");
}

export async function listExpenses(weddingId: string, { page, limit, category, eventId, vendorId, from, to }: ExpenseFilters) {
  await connectDatabase();
  const filter: QueryFilter<ExpenseRecord> = { weddingId: new Types.ObjectId(weddingId) };
  if (category) filter.category = category;
  if (eventId) filter.eventId = eventId === "none" ? null : new Types.ObjectId(eventId);
  if (vendorId) filter.vendorId = vendorId === "none" ? null : new Types.ObjectId(vendorId);
  if (from || to) filter.expenseDate = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  const [result] = await WeddingExpense.aggregate<{ rows: ExpenseRecord[]; matched: { total: number; subtotalPaise: number }[] }>([
    { $match: filter },
    { $sort: { expenseDate: -1, _id: -1 } },
    { $facet: {
      rows: [{ $skip: (page - 1) * limit }, { $limit: limit }],
      matched: [{ $group: { _id: null, total: { $sum: 1 }, subtotalPaise: { $sum: "$amountPaise" } } }],
    } },
  ]);
  const { total, subtotalPaise } = result?.matched[0] ?? { total: 0, subtotalPaise: 0 };
  if (!Number.isSafeInteger(subtotalPaise)) throw new Error("Expense subtotal exceeded the supported range.");
  return { data: (result?.rows ?? []).map(expenseView), subtotalPaise, pagination: { page, limit, total } };
}

export async function expenseSummary(weddingId: string) {
  await connectDatabase();
  const groups = await WeddingExpense.aggregate<{ _id: ExpenseCategory; amountPaise: number }>([
    { $match: { weddingId: new Types.ObjectId(weddingId) } },
    { $group: { _id: "$category", amountPaise: { $sum: "$amountPaise" } } },
    { $sort: { amountPaise: -1, _id: 1 } },
  ]);
  const byCategory = groups.map(({ _id, amountPaise }) => ({ category: _id, amountPaise }));
  const totalExpensePaise = byCategory.reduce((sum, item) => sum + item.amountPaise, 0);
  if (!Number.isSafeInteger(totalExpensePaise)) throw new Error("Expense total exceeded the supported range.");
  return { totalExpensePaise, currency: "INR" as const, byCategory };
}

export async function getExpense(weddingId: string, id: string) {
  await connectDatabase();
  const expense = await WeddingExpense.findOne({ weddingId, _id: id }).lean();
  return expense && expenseView(expense);
}

export async function createExpense(weddingId: string, membershipId: string, values: ExpenseValues, requestKey?: string) {
  const database = await connectDatabase();
  await prepareExpenseStorage();
  const { eventId, vendorId, notes, ...fields } = values;
  const request = { weddingId, membershipId, requestKey };
  const fingerprint = createHash("sha256").update(JSON.stringify([
    // Preserve earlier request fingerprints for expenses created without a vendor.
    fields.title, fields.amountPaise, fields.currency, fields.expenseDate, fields.category, eventId ?? null, notes || null,
    ...(vendorId ? [vendorId] : []),
  ])).digest("hex");

  async function replay(claim: ExpenseCreationRecord, session?: ClientSession) {
    const expense = await WeddingExpense.findOne({ weddingId, _id: claim.expenseId }).session(session ?? null).lean();
    if (!expense) throw new ExpenseProblem(410, "EXPENSE_DELETED", "This expense was deleted. Open a new draft to add another one.");
    if (claim.fingerprint !== fingerprint) {
      throw new ExpenseProblem(409, "EXPENSE_ALREADY_CREATED", "An expense was already added from this draft. Reopen the saved expense to edit it.");
    }
    return { expense: expenseView(expense), replayed: true };
  }

  try {
    return await database.transaction(async (session) => {
      if (requestKey) {
        const existing = await ExpenseCreationRequest.findOne(request).session(session).lean();
        if (existing) return replay(existing, session);
      }
      if (eventId && !await lockActiveEventReferences(weddingId, [eventId], session)) throw eventUnavailable();
      if (vendorId && !await lockActiveVendorReference(weddingId, vendorId, session)) throw vendorUnavailable();
      const expense = await new WeddingExpense({
        weddingId, createdByMembershipId: membershipId, ...fields,
        eventId: eventId || undefined, vendorId: vendorId || undefined, notes: notes || undefined,
      }).save({ session });
      if (requestKey) await new ExpenseCreationRequest({ ...request, expenseId: expense._id, fingerprint }).save({ session });
      return { expense: expenseView(expense), replayed: false };
    });
  } catch (error) {
    if (requestKey && (error as { code?: number } | null)?.code === 11000) {
      const existing = await ExpenseCreationRequest.findOne(request).lean();
      if (existing) return replay(existing);
    }
    throw error;
  }
}

export async function updateExpense(weddingId: string, id: string, changes: ExpenseChanges, revision?: number) {
  const database = await connectDatabase();
  const { eventId, vendorId, notes, ...fields } = changes;
  const scope = { weddingId, _id: id };
  return database.transaction(async (session) => {
    const existing = await WeddingExpense.findOne(scope).session(session).lean();
    if (!existing) return null;
    const view = expenseView(existing);
    const submitted = { ...fields, ...(eventId !== undefined && { eventId }), ...(vendorId !== undefined && { vendorId }),
      ...(notes !== undefined && { notes: notes || null }) };
    if (Object.entries(submitted).every(([key, value]) => view[key as keyof Expense] === value)) return view;
    if (revision !== undefined && revision !== view.revision) throw conflict();
    if (eventId && eventId !== view.eventId && !await lockActiveEventReferences(weddingId, [eventId], session)) throw eventUnavailable();
    if (vendorId && vendorId !== view.vendorId && !await lockActiveVendorReference(weddingId, vendorId, session)) throw vendorUnavailable();

    const updated = await WeddingExpense.findOneAndUpdate(scope, {
      $set: { ...fields, ...(eventId && { eventId }), ...(vendorId && { vendorId }), ...(notes && { notes }) },
      $unset: { ...(eventId === null && { eventId: 1 }), ...(vendorId === null && { vendorId: 1 }),
        ...(notes !== undefined && !notes && { notes: 1 }) },
      $inc: { __v: 1 },
    }, { session, returnDocument: "after", runValidators: true }).lean();
    return updated && expenseView(updated);
  });
}

export async function deleteExpense(weddingId: string, id: string, revision?: number) {
  await connectDatabase();
  const scope = { weddingId, _id: id };
  if ((await WeddingExpense.deleteOne({ ...scope, ...(revision !== undefined && { __v: revision }) })).deletedCount) return true;
  if (revision !== undefined && await WeddingExpense.exists(scope)) throw conflict();
  return false;
}
