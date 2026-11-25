import "server-only";
import { createHash } from "node:crypto";
import { Types, type ClientSession, type QueryFilter } from "mongoose";
import { lockActiveEventReferences } from "@/modules/events/service";
import { connectDatabase } from "@/server/db/mongoose";
import { prepareVendorStorage, WeddingVendor, type VendorRecord } from "./model";
import type { VendorChanges, VendorFilters, VendorValues } from "./validation";

export class VendorProblem extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, string>,
    public retryAfter?: number) {
    super(message);
  }
}

export function vendorDraftContext(weddingId: string, membershipId: string) {
  return createHash("sha256").update(JSON.stringify([weddingId, membershipId])).digest("hex");
}

export function vendorView(vendor: VendorRecord) {
  return {
    id: vendor._id.toString(), name: vendor.name, category: vendor.category,
    contactPerson: vendor.contactPerson ?? null, phone: vendor.phone ?? null, email: vendor.email ?? null,
    address: vendor.address ?? null, website: vendor.website ?? null, notes: vendor.notes ?? null,
    totalAgreedCostPaise: vendor.totalAgreedCostPaise ?? null, eventIds: vendor.eventIds.map(String),
    source: vendor.source, archivedAt: vendor.archivedAt?.toISOString() ?? null, revision: vendor.__v ?? 0,
  };
}

export type Vendor = ReturnType<typeof vendorView>;

function eventUnavailable() {
  const message = "Choose active events from your wedding.";
  return new VendorProblem(404, "EVENT_UNAVAILABLE", message, { eventIds: message });
}

function conflict() {
  return new VendorProblem(409, "CONFLICT", "This vendor changed. Reopen it to review the latest details.");
}

export async function listVendors(weddingId: string, { page, limit, category, search, includeArchived, status }: VendorFilters) {
  await connectDatabase();
  const filter: QueryFilter<VendorRecord> = { weddingId };
  if (status === "archived") filter.archivedAt = { $type: "date" };
  else if (status === "active" || !includeArchived) filter.archivedAt = null;
  if (category) filter.category = category;
  if (search) {
    const literal = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: literal }, { contactPerson: literal }];
  }
  const [rows, total, directory] = await Promise.all([
    WeddingVendor.find(filter).sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    WeddingVendor.countDocuments(filter),
    vendorDirectory(weddingId),
  ]);
  return { data: rows.map(vendorView), pagination: { page, limit, total }, directory };
}

async function vendorDirectory(weddingId: string) {
  const [result] = await WeddingVendor.aggregate<{
    counts: { _id: boolean; count: number; agreedPaise: number }[]; coverage: { count: number }[];
  }>([
    { $match: { weddingId: new Types.ObjectId(weddingId) } },
    { $facet: {
      counts: [{ $group: { _id: { $ne: [{ $ifNull: ["$archivedAt", null] }, null] }, count: { $sum: 1 },
        agreedPaise: { $sum: "$totalAgreedCostPaise" } } }],
      coverage: [{ $match: { archivedAt: null } }, { $unwind: "$eventIds" }, { $group: { _id: "$eventIds" } }, { $count: "count" }],
    } },
  ]);
  const active = result?.counts.find(({ _id }) => !_id);
  const totalAgreedCostPaise = active?.agreedPaise ?? 0;
  if (!Number.isSafeInteger(totalAgreedCostPaise)) throw new Error("Vendor total exceeded the supported range.");
  return { active: active?.count ?? 0, archived: result?.counts.find(({ _id }) => _id)?.count ?? 0,
    eventsCovered: result?.coverage[0]?.count ?? 0, totalAgreedCostPaise };
}

export async function activeVendorCount(weddingId: string) {
  await connectDatabase();
  return WeddingVendor.countDocuments({ weddingId, archivedAt: null });
}

export async function vendorOptions(weddingId: string) {
  await connectDatabase();
  const rows = await WeddingVendor.find({ weddingId }).select("name archivedAt").sort({ name: 1, _id: 1 }).lean();
  return rows.map(({ _id, name, archivedAt }) => ({ id: _id.toString(), name, archived: Boolean(archivedAt) }));
}

export async function lockActiveVendorReference(weddingId: string, id: string, session: ClientSession) {
  const result = await WeddingVendor.updateOne({ weddingId, _id: id, archivedAt: null },
    { $inc: { expenseReferenceRevision: 1 } }, { session, timestamps: false, strict: false });
  return result.matchedCount === 1;
}

export async function getVendor(weddingId: string, id: string) {
  await connectDatabase();
  const vendor = await WeddingVendor.findOne({ _id: id, weddingId }).lean();
  return vendor && vendorView(vendor);
}

function compact(values: VendorChanges) {
  return Object.entries(values).filter(([, value]) => value !== undefined)
    .map(([field, value]) => [field, value === "" ? null : value] as const);
}

export async function createVendor(weddingId: string, values: VendorValues, requestKey?: string) {
  const database = await connectDatabase();
  await prepareVendorStorage();
  const clean = compact(values).filter(([, value]) => value !== null).sort(([left], [right]) => left.localeCompare(right));
  const fingerprint = createHash("sha256").update(JSON.stringify(clean)).digest("hex");
  const request = { weddingId, requestKey };

  function replay(vendor: VendorRecord) {
    if (vendor.requestFingerprint !== fingerprint) {
      throw new VendorProblem(409, "VENDOR_ALREADY_CREATED", "A vendor was already added from this draft. Open the saved vendor to edit it.");
    }
    if (vendor.archivedAt) throw new VendorProblem(410, "VENDOR_ARCHIVED", "This vendor was archived. Find it in the Archived view.");
    return { vendor: vendorView(vendor), replayed: true };
  }

  try {
    return await database.transaction(async (session) => {
      if (requestKey) {
        const existing = await WeddingVendor.findOne(request).select("+requestFingerprint").session(session).lean();
        if (existing) return replay(existing);
      }
      if (!await lockActiveEventReferences(weddingId, values.eventIds, session)) throw eventUnavailable();
      const saved = await new WeddingVendor({
        ...Object.fromEntries(clean), weddingId, source: "MANUAL",
        ...(requestKey && { requestKey, requestFingerprint: fingerprint }),
      }).save({ session });
      return { vendor: vendorView(saved), replayed: false };
    });
  } catch (error) {
    if (requestKey && (error as { code?: number } | null)?.code === 11000) {
      const existing = await WeddingVendor.findOne(request).select("+requestFingerprint").lean();
      if (existing) return replay(existing);
    }
    throw error;
  }
}

export async function updateVendor(weddingId: string, id: string, changes: VendorChanges, revision?: number) {
  const database = await connectDatabase();
  const scope = { weddingId, _id: id };
  const entries = compact(changes);
  return database.transaction(async (session) => {
    const existing = await WeddingVendor.findOne(scope).session(session).lean();
    if (!existing) return null;
    if (existing.archivedAt) throw new VendorProblem(409, "VENDOR_ARCHIVED", "Archived vendors are available for reference.");
    const view = vendorView(existing);
    if (entries.every(([key, value]) => {
      const previous = view[key as keyof Vendor];
      return key === "eventIds" ? JSON.stringify([...view.eventIds].sort()) === JSON.stringify(value) : previous === value;
    })) return view;
    if (revision !== undefined && revision !== view.revision) throw conflict();
    const newEventIds = changes.eventIds?.filter((eventId) => !view.eventIds.includes(eventId)) ?? [];
    if (!await lockActiveEventReferences(weddingId, newEventIds, session)) throw eventUnavailable();
    const updated = await WeddingVendor.findOneAndUpdate(scope, {
      $set: Object.fromEntries(entries.filter(([, value]) => value !== null)),
      $unset: Object.fromEntries(entries.filter(([, value]) => value === null).map(([field]) => [field, 1])),
      $inc: { __v: 1 },
    }, { session, returnDocument: "after", runValidators: true }).lean();
    return updated && vendorView(updated);
  });
}

export async function archiveVendor(weddingId: string, id: string, revision?: number) {
  await connectDatabase();
  const scope = { weddingId, _id: id };
  const changed = await WeddingVendor.findOneAndUpdate({
    ...scope, archivedAt: null, ...(revision !== undefined && { __v: revision }),
  }, { $set: { archivedAt: new Date() }, $inc: { __v: 1 } }, { returnDocument: "after" }).lean();
  if (changed) return vendorView(changed);
  const current = await WeddingVendor.findOne(scope).lean();
  if (!current) return null;
  if (current.archivedAt) return vendorView(current);
  throw conflict();
}
