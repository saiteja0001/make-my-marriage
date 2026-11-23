import "server-only";
import { model, models, Schema, type Model, type Types } from "mongoose";
import { connectDatabase } from "@/server/db/mongoose";
import { eventFieldLimits, eventTypes, type EventType } from "./validation";

export type EventRecord = {
  _id: Types.ObjectId;
  weddingId: Types.ObjectId;
  name: string;
  type?: EventType;
  startsAt: Date;
  endsAt?: Date;
  venueName?: string;
  address?: string;
  description?: string;
  dressCode?: string;
  archivedAt?: Date;
  requestKey?: string;
  __v?: number;
};

const schema = new Schema<EventRecord>({
  weddingId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true, maxlength: eventFieldLimits.name },
  type: { type: String, enum: Object.keys(eventTypes) },
  startsAt: { type: Date, required: true },
  endsAt: Date,
  venueName: { type: String, maxlength: eventFieldLimits.venueName },
  address: { type: String, maxlength: eventFieldLimits.address },
  description: { type: String, maxlength: eventFieldLimits.description },
  dressCode: { type: String, maxlength: eventFieldLimits.dressCode },
  archivedAt: Date,
  requestKey: { type: String, select: false },
}, { timestamps: true, autoCreate: false, autoIndex: false });

schema.index({ weddingId: 1, startsAt: 1, _id: 1 });
schema.index({ weddingId: 1, archivedAt: 1, startsAt: 1, _id: 1 });
schema.index({ weddingId: 1, requestKey: 1 }, {
  unique: true,
  partialFilterExpression: { requestKey: { $type: "string" } },
});

export const WeddingEvent: Model<EventRecord> = models.WeddingEvent
  ?? model<EventRecord>("WeddingEvent", schema, "events");

let storageReady: Promise<unknown> | undefined;

export async function prepareEventStorage() {
  await connectDatabase();
  storageReady ??= WeddingEvent.createIndexes().catch((error: unknown) => {
    storageReady = undefined;
    throw error;
  });
  await storageReady;
}
