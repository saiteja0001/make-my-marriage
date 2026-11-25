import "server-only";
import { model, models, Schema, type Model, type Types } from "mongoose";
import { vendorCategories, vendorLimits, type VendorCategory } from "./validation";

export type VendorRecord = {
  _id: Types.ObjectId;
  weddingId: Types.ObjectId;
  name: string;
  category: VendorCategory;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  totalAgreedCostPaise?: number;
  eventIds: Types.ObjectId[];
  notes?: string;
  source: "MANUAL";
  archivedAt?: Date;
  expenseReferenceRevision?: number;
  requestKey?: string;
  requestFingerprint?: string;
  __v?: number;
};

const schema = new Schema<VendorRecord>({
  weddingId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true, maxlength: vendorLimits.name },
  category: { type: String, required: true, enum: Object.keys(vendorCategories) },
  contactPerson: { type: String, maxlength: vendorLimits.contactPerson },
  phone: { type: String, maxlength: vendorLimits.phone },
  email: { type: String, maxlength: vendorLimits.email },
  address: { type: String, maxlength: vendorLimits.address },
  website: { type: String, maxlength: vendorLimits.website },
  totalAgreedCostPaise: { type: Number, min: 0, max: vendorLimits.costPaise, validate: Number.isSafeInteger },
  eventIds: [{ type: Schema.Types.ObjectId }],
  notes: { type: String, maxlength: vendorLimits.notes },
  source: { type: String, enum: ["MANUAL"], required: true },
  archivedAt: Date,
  expenseReferenceRevision: Number,
  requestKey: { type: String, select: false },
  requestFingerprint: { type: String, select: false },
}, { timestamps: true, autoCreate: false, autoIndex: false });

schema.index({ weddingId: 1, archivedAt: 1, name: 1, _id: 1 });
schema.index({ weddingId: 1, category: 1, archivedAt: 1, name: 1 });
schema.index({ weddingId: 1, requestKey: 1 }, { unique: true, partialFilterExpression: { requestKey: { $type: "string" } } });

export const WeddingVendor: Model<VendorRecord> = models.WeddingVendor ?? model("WeddingVendor", schema, "vendors");

let ready: Promise<unknown> | undefined;
export function prepareVendorStorage() {
  ready ??= WeddingVendor.createIndexes().catch((error: unknown) => { ready = undefined; throw error; });
  return ready;
}
