import "server-only";
import { model, models, Schema, type Model, type Types } from "mongoose";
import { expenseCategories, expenseMaxPaise, expenseNotesLimit, expenseTitleLimit, type ExpenseCategory } from "./validation";

export type ExpenseRecord = {
  _id: Types.ObjectId;
  weddingId: Types.ObjectId;
  createdByMembershipId: Types.ObjectId;
  title: string;
  amountPaise: number;
  currency: "INR";
  expenseDate: string;
  category: ExpenseCategory;
  eventId?: Types.ObjectId;
  notes?: string;
  __v?: number;
};

const schema = new Schema<ExpenseRecord>({
  weddingId: { type: Schema.Types.ObjectId, required: true },
  createdByMembershipId: { type: Schema.Types.ObjectId, required: true },
  title: { type: String, required: true, maxlength: expenseTitleLimit },
  amountPaise: { type: Number, required: true, min: 1, max: expenseMaxPaise, validate: Number.isSafeInteger },
  currency: { type: String, required: true, enum: ["INR"] },
  expenseDate: { type: String, required: true },
  category: { type: String, required: true, enum: Object.keys(expenseCategories) },
  eventId: Schema.Types.ObjectId,
  notes: { type: String, maxlength: expenseNotesLimit },
}, { timestamps: true, autoCreate: false, autoIndex: false });

schema.index({ weddingId: 1, expenseDate: -1, _id: -1 });
schema.index({ weddingId: 1, category: 1, expenseDate: -1 });
schema.index({ weddingId: 1, eventId: 1, expenseDate: -1 });
export const WeddingExpense: Model<ExpenseRecord> = models.WeddingExpense ?? model("WeddingExpense", schema, "expenses");

export type ExpenseCreationRecord = {
  weddingId: Types.ObjectId;
  membershipId: Types.ObjectId;
  expenseId: Types.ObjectId;
  requestKey: string;
  fingerprint: string;
};

const requestSchema = new Schema<ExpenseCreationRecord>({
  weddingId: { type: Schema.Types.ObjectId, required: true },
  membershipId: { type: Schema.Types.ObjectId, required: true },
  expenseId: { type: Schema.Types.ObjectId, required: true },
  requestKey: { type: String, required: true },
  fingerprint: { type: String, required: true },
}, { autoCreate: false, autoIndex: false });
requestSchema.index({ weddingId: 1, membershipId: 1, requestKey: 1 }, { unique: true });

export const ExpenseCreationRequest: Model<ExpenseCreationRecord> = models.ExpenseCreationRequest
  ?? model("ExpenseCreationRequest", requestSchema, "expense_creation_requests");

let ready: Promise<unknown> | undefined;

export function prepareExpenseStorage() {
  ready ??= Promise.all([WeddingExpense.createIndexes(), ExpenseCreationRequest.createIndexes()]).catch((error: unknown) => {
    ready = undefined;
    throw error;
  });
  return ready;
}
