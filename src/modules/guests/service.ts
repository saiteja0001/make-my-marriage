import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { Types, type ClientSession, type QueryFilter } from "mongoose";
import { WeddingEvent } from "@/modules/events/model";
import { lockActiveEventReferences } from "@/modules/events/service";
import { connectDatabase } from "@/server/db/mongoose";
import { GuestCreationRequest, prepareGuestStorage, WeddingGuest, type GuestRecord } from "./model";
import type { GuestChanges, GuestFilters, GuestValues } from "./validation";

export class GuestConflict extends Error {
  constructor() {
    super("This guest group changed. Open the latest version before trying again.");
  }
}

export class GuestEventUnavailable extends Error {
  constructor() {
    super("Choose active events from your wedding.");
  }
}

export class GuestCapacityConflict extends Error {
  constructor(count: number) {
    super(`The party limit must be at least ${count} to cover recorded attendance.`);
  }
}

export class GuestCreationGone extends Error {
  constructor() {
    super("This request created a guest group that was deleted. Choose Add as a new group to use this draft again.");
  }
}

export function guestDraftContext(membershipId: string, weddingId: string) {
  return createHash("sha256").update(JSON.stringify([membershipId, weddingId])).digest("hex");
}

const projection = "name email phone notes maxGuests invitedEventIds rsvpStatus attendingCount rsvpUpdatedAt invitationSentAt lastReminderSentAt __v";

async function lookupEvents(weddingId: string, ids?: string[]) {
  const events = await WeddingEvent.find({ weddingId, ...(ids && { _id: { $in: ids } }) })
    .select("name startsAt archivedAt").sort({ startsAt: 1, _id: 1 }).lean();
  return events.map(({ _id, name, startsAt, archivedAt }) => ({
    id: _id.toString(), name, startsAt: startsAt.toISOString(), archivedAt: archivedAt?.toISOString() ?? null,
  }));
}

export async function guestEventOptions(weddingId: string) {
  await connectDatabase();
  return lookupEvents(weddingId);
}

async function guestDetails(weddingId: string, guests: GuestRecord[]) {
  const uniqueEvents = new Set(guests.flatMap((guest) => (guest.invitedEventIds ?? []).map(String)));
  const events = uniqueEvents.size ? await lookupEvents(weddingId, [...uniqueEvents]) : [];
  const byId = new Map(events.map((event) => [event.id, event]));

  return guests.map((guest) => {
    const invitedEventIds = (guest.invitedEventIds ?? []).map(String);
    return {
      id: guest._id.toString(), name: guest.name, maxGuests: guest.maxGuests,
      email: guest.email ?? null, phone: guest.phone ?? null, notes: guest.notes ?? null,
      invitedEventIds,
      invitedEvents: invitedEventIds.flatMap((id) => {
        const event = byId.get(id);
        return event ? [event] : [];
      }),
      rsvpStatus: guest.rsvpStatus ?? "PENDING", attendingCount: guest.attendingCount ?? null,
      rsvpUpdatedAt: guest.rsvpUpdatedAt?.toISOString() ?? null,
      invitationSentAt: guest.invitationSentAt?.toISOString() ?? null,
      lastReminderSentAt: guest.lastReminderSentAt?.toISOString() ?? null,
      revision: guest.__v ?? 0,
    };
  });
}

export type GuestDetails = Awaited<ReturnType<typeof guestDetails>>[number];

export async function listGuests(weddingId: string, filters: GuestFilters) {
  await connectDatabase();
  const { page, limit, search, eventId, rsvpStatus, invitationSent } = filters;
  const filter: QueryFilter<GuestRecord> = { weddingId };
  if (search) {
    const pattern = { $regex: search.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&"), $options: "i" };
    filter.$or = [{ name: pattern }, { emailNormalized: pattern }, { email: pattern }, { phone: pattern }];
  }
  if (eventId) filter.invitedEventIds = eventId;
  if (rsvpStatus) filter.rsvpStatus = rsvpStatus === "PENDING" ? { $in: ["PENDING", null] } : rsvpStatus;
  if (invitationSent !== undefined) filter.invitationSentAt = invitationSent ? { $ne: null } : null;

  const [records, total] = await Promise.all([
    WeddingGuest.find(filter).select(projection).sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    WeddingGuest.countDocuments(filter),
  ]);
  return { data: await guestDetails(weddingId, records), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getGuestOverview(weddingId: string) {
  await connectDatabase();
  const [summary] = await WeddingGuest.aggregate<{
    groups: number; capacity: number; attending: number; declined: number; peopleAttending: number;
  }>([
    { $match: { weddingId: new Types.ObjectId(weddingId) } },
    { $group: {
      _id: null, groups: { $sum: 1 }, capacity: { $sum: "$maxGuests" },
      attending: { $sum: { $cond: [{ $eq: ["$rsvpStatus", "ATTENDING"] }, 1, 0] } },
      declined: { $sum: { $cond: [{ $eq: ["$rsvpStatus", "NOT_ATTENDING"] }, 1, 0] } },
      peopleAttending: { $sum: { $cond: [{ $eq: ["$rsvpStatus", "ATTENDING"] }, "$attendingCount", 0] } },
    } },
  ]);
  const { groups, capacity, attending, declined, peopleAttending } = summary ?? {
    groups: 0, capacity: 0, attending: 0, declined: 0, peopleAttending: 0,
  };
  return { groups, capacity, attending, declined, pending: groups - attending - declined, peopleAttending };
}

export async function getGuest(weddingId: string, guestId: string) {
  await connectDatabase();
  const record = await WeddingGuest.findOne({ weddingId, _id: guestId }).select(projection).lean();
  return record ? (await guestDetails(weddingId, [record]))[0] : null;
}

async function creationReplay(weddingId: string, requestKey: string, session?: ClientSession) {
  const receipt = await GuestCreationRequest.findOne({ weddingId, requestKey }).session(session ?? null).lean();
  if (!receipt) return null;
  const record = await WeddingGuest.findOne({ weddingId, _id: receipt.guestId }).select(projection).session(session ?? null).lean();
  if (!record) throw new GuestCreationGone();
  return record;
}

export async function createGuest(weddingId: string, input: GuestValues, requestKey?: string) {
  const database = await prepareGuestStorage();
  const { record, replayed } = await database.transaction(async (session) => {
    if (requestKey) {
      const replay = await creationReplay(weddingId, requestKey, session);
      if (replay) return { record: replay, replayed: true };
    }
    const record = new WeddingGuest({
      ...input, weddingId,
      email: input.email || undefined,
      emailNormalized: input.email?.toLowerCase() || undefined,
      phone: input.phone || undefined,
      notes: input.notes || undefined,
      invitationToken: randomBytes(32).toString("base64url"),
    });
    if (requestKey) await new GuestCreationRequest({ weddingId, requestKey, guestId: record._id }).save({ session });
    if (!await lockActiveEventReferences(weddingId, input.invitedEventIds, session)) throw new GuestEventUnavailable();
    await record.save({ session });
    return { record, replayed: false };
  }).catch(async (error: unknown) => {
    const duplicate = error as { code?: number; keyPattern?: { requestKey?: number } } | null;
    if (!requestKey || duplicate?.code !== 11000 || duplicate.keyPattern?.requestKey !== 1) throw error;
    const record = await creationReplay(weddingId, requestKey);
    if (!record) throw error;
    return { record, replayed: true };
  });
  return { guest: (await guestDetails(weddingId, [record]))[0], replayed };
}

export async function updateGuest(weddingId: string, guestId: string, input: GuestChanges, revision?: number) {
  const database = await connectDatabase();
  const scope = { weddingId, _id: guestId };
  const current = await WeddingGuest.findOne(scope).select(projection).lean();
  if (!current) return null;
  if (revision !== undefined && revision !== (current.__v ?? 0)) throw new GuestConflict();
  if (input.maxGuests !== undefined && input.maxGuests < (current.attendingCount ?? 0)) {
    throw new GuestCapacityConflict(current.attendingCount ?? 0);
  }

  const currentEvents = new Set((current.invitedEventIds ?? []).map(String));
  const addedEvents = input.invitedEventIds?.filter((id) => !currentEvents.has(id)) ?? [];
  const set: Record<string, string | number | string[]> = {};
  const unset: Record<string, 1> = {};
  for (const [field, value] of Object.entries(input)) {
    if (value === "") unset[field] = 1;
    else if (value !== undefined) set[field] = value;
  }
  if (input.email === "") unset.emailNormalized = 1;
  else if (input.email !== undefined) set.emailNormalized = input.email.toLowerCase();
  const filter: QueryFilter<GuestRecord> = {
    ...scope, __v: current.__v ?? { $exists: false },
    ...(input.maxGuests !== undefined && { $or: [{ attendingCount: null }, { attendingCount: { $lte: input.maxGuests } }] }),
  };

  const updated = await database.transaction(async (session) => {
    if (!await lockActiveEventReferences(weddingId, addedEvents, session)) throw new GuestEventUnavailable();
    const record = await WeddingGuest.findOneAndUpdate(filter, { $set: set, $unset: unset, $inc: { __v: 1 } },
      { session, returnDocument: "after", runValidators: true }).select(projection).lean();
    if (!record) throw new GuestConflict();
    return record;
  });
  return (await guestDetails(weddingId, [updated]))[0];
}

export async function deleteGuest(weddingId: string, guestId: string, revision?: number) {
  await connectDatabase();
  const scope = { weddingId, _id: guestId };
  const result = await WeddingGuest.deleteOne(revision === undefined ? scope : {
    ...scope, __v: revision === 0 ? { $in: [0, null] } : revision,
  });
  if (!result.deletedCount && revision !== undefined && await WeddingGuest.exists(scope)) throw new GuestConflict();
  return result.deletedCount > 0;
}
