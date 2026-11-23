import "server-only";
import { createHash } from "node:crypto";
import type { ClientSession, QueryFilter } from "mongoose";
import { connectDatabase } from "@/server/db/mongoose";
import { prepareEventStorage, WeddingEvent, type EventRecord } from "./model";
import { endTimeMessage, validEventRange, type EventChanges, type EventValues } from "./validation";

export class EventConflict extends Error {}
export class InvalidEventRange extends Error {
  constructor() {
    super(endTimeMessage);
  }
}

function serializeEvent(event: EventRecord) {
  return {
    id: event._id.toString(),
    name: event.name,
    type: event.type,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString(),
    venueName: event.venueName,
    address: event.address,
    description: event.description,
    dressCode: event.dressCode,
    archivedAt: event.archivedAt?.toISOString(),
    revision: event.__v ?? 0,
  };
}

export type EventDetails = ReturnType<typeof serializeEvent>;

export function eventDraftContext(accountId: string, weddingId: string, timeZone: string) {
  return createHash("sha256").update(JSON.stringify([accountId, weddingId, timeZone])).digest("hex");
}

const scheduleOrder = { startsAt: 1, _id: 1 } as const;

export async function lockActiveEventReferences(weddingId: string, eventIds: string[], session: ClientSession) {
  if (!eventIds.length) return true;
  // Keep the fixed lock write compatible with event models cached before this field existed.
  const result = await WeddingEvent.updateMany({ weddingId, _id: { $in: eventIds }, archivedAt: null },
    { $inc: { taskReferenceRevision: 1 } }, { session, timestamps: false, strict: false });
  return result.matchedCount === eventIds.length;
}

export async function listEvents(weddingId: string, options: { includeArchived?: boolean; from?: string; to?: string } = {}) {
  await connectDatabase();
  const filter: QueryFilter<EventRecord> = { weddingId };
  if (!options.includeArchived) filter.archivedAt = null;
  if (options.from || options.to) {
    filter.startsAt = {
      ...(options.from && { $gte: new Date(options.from) }),
      ...(options.to && { $lte: new Date(options.to) }),
    };
  }
  const events = await WeddingEvent.find(filter).sort(scheduleOrder).lean();
  return events.map(serializeEvent);
}

export async function getEvent(weddingId: string, eventId: string) {
  await connectDatabase();
  const event = await WeddingEvent.findOne({ _id: eventId, weddingId }).lean();
  return event && serializeEvent(event);
}

export async function getEventOverview(weddingId: string, now = new Date()) {
  await connectDatabase();
  const active = { weddingId, archivedAt: null };
  const [count, upcoming] = await Promise.all([
    WeddingEvent.countDocuments(active),
    WeddingEvent.find({ ...active, startsAt: { $gte: now } }).sort(scheduleOrder).limit(3).lean(),
  ]);
  return { count, upcoming: upcoming.map(serializeEvent) };
}

export async function createEvent(weddingId: string, input: EventValues, requestKey?: string) {
  await prepareEventStorage();
  try {
    const fields = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== "" && value != null));
    return { event: serializeEvent(await WeddingEvent.create({ ...fields, weddingId, requestKey })), replayed: false };
  } catch (error) {
    const duplicate = error as { code?: number; keyPattern?: { requestKey?: number } };
    if (requestKey && duplicate.code === 11000 && duplicate.keyPattern?.requestKey === 1) {
      const existing = await WeddingEvent.findOne({ weddingId, requestKey }).lean();
      if (existing) return { event: serializeEvent(existing), replayed: true };
    }
    throw error;
  }
}

export async function updateEvent(weddingId: string, eventId: string, input: EventChanges, revision?: number) {
  await connectDatabase();
  const scope = { _id: eventId, weddingId };
  const current = await WeddingEvent.findOne(scope).lean();
  if (!current) return null;
  if (current.archivedAt) throw new EventConflict("This event has been archived and can no longer be edited.");
  if (revision !== undefined && revision !== (current.__v ?? 0)) {
    throw new EventConflict("This event changed. Reload it before editing again.");
  }

  const startsAt = input.startsAt ? new Date(input.startsAt) : current.startsAt;
  const endsAt = input.endsAt === undefined ? current.endsAt : input.endsAt ? new Date(input.endsAt) : null;
  if (!validEventRange(startsAt, endsAt)) throw new InvalidEventRange();

  const set: Record<string, string> = {};
  const unset: Record<string, 1> = {};
  for (const [field, value] of Object.entries(input)) {
    if (value === "" || value === null) unset[field] = 1;
    else if (value !== undefined) set[field] = value;
  }

  const updated = await WeddingEvent.findOneAndUpdate({
    ...scope,
    archivedAt: null,
    __v: current.__v ?? { $exists: false },
  }, { $set: set, $unset: unset, $inc: { __v: 1 } }, { returnDocument: "after", runValidators: true }).lean();
  if (!updated) throw new EventConflict("This event changed. Reload it before editing again.");
  return serializeEvent(updated);
}

export async function archiveEvent(weddingId: string, eventId: string) {
  await connectDatabase();
  const scope = { _id: eventId, weddingId };
  const archived = await WeddingEvent.updateOne(
    { ...scope, archivedAt: null },
    { $set: { archivedAt: new Date() }, $inc: { __v: 1 } },
  );
  return archived.matchedCount > 0 || Boolean(await WeddingEvent.exists(scope));
}
