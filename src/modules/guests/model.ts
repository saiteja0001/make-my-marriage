import "server-only";
import { model, models, Schema, type Model, type Types } from "mongoose";
import { connectDatabase } from "@/server/db/mongoose";
import { guestLimits, rsvpStatuses, type RsvpStatus } from "./validation";

export type GuestRecord = {
  _id: Types.ObjectId;
  weddingId: Types.ObjectId;
  name: string;
  email?: string;
  emailNormalized?: string;
  phone?: string;
  notes?: string;
  maxGuests: number;
  invitedEventIds: Types.ObjectId[];
  invitationToken: string;
  invitationSentAt?: Date | null;
  lastReminderSentAt?: Date | null;
  reminderCount: number;
  rsvpStatus: RsvpStatus;
  attendingCount?: number | null;
  rsvpUpdatedAt?: Date | null;
  __v?: number;
};

const storage = { autoCreate: false, autoIndex: false } as const;
const guestSchema = new Schema<GuestRecord>({
  weddingId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true, maxlength: guestLimits.name },
  email: { type: String, maxlength: guestLimits.email },
  emailNormalized: { type: String, select: false },
  phone: { type: String, maxlength: guestLimits.phone },
  notes: { type: String, maxlength: guestLimits.notes },
  maxGuests: { type: Number, required: true, min: 1, max: guestLimits.maxGuests, default: 1 },
  invitedEventIds: { type: [Schema.Types.ObjectId], default: [] },
  invitationToken: { type: String, required: true, unique: true, select: false },
  invitationSentAt: { type: Date, default: null },
  lastReminderSentAt: { type: Date, default: null },
  reminderCount: { type: Number, default: 0 },
  rsvpStatus: { type: String, enum: Object.keys(rsvpStatuses), default: "PENDING" },
  attendingCount: { type: Number, default: null },
  rsvpUpdatedAt: { type: Date, default: null },
}, { ...storage, timestamps: true });

guestSchema.index({ weddingId: 1, name: 1, _id: 1 });
guestSchema.index({ weddingId: 1, rsvpStatus: 1 });
guestSchema.index({ weddingId: 1, emailNormalized: 1 });
guestSchema.index({ weddingId: 1, invitedEventIds: 1 });

export const WeddingGuest: Model<GuestRecord> = models.WeddingGuest ?? model<GuestRecord>("WeddingGuest", guestSchema, "guests");

type GuestCreationRecord = { weddingId: Types.ObjectId; requestKey: string; guestId: Types.ObjectId };
const creationSchema = new Schema<GuestCreationRecord>({
  weddingId: { type: Schema.Types.ObjectId, required: true },
  requestKey: { type: String, required: true },
  guestId: { type: Schema.Types.ObjectId, required: true },
}, { ...storage, versionKey: false });
creationSchema.index({ weddingId: 1, requestKey: 1 }, { unique: true });

export const GuestCreationRequest: Model<GuestCreationRecord> = models.GuestCreationRequest
  ?? model<GuestCreationRecord>("GuestCreationRequest", creationSchema, "guest_creation_requests");

let storageReady: Promise<unknown> | undefined;
export async function prepareGuestStorage() {
  const connection = await connectDatabase();
  storageReady ??= Promise.all([WeddingGuest.createIndexes(), GuestCreationRequest.createIndexes()]).catch((error: unknown) => {
    storageReady = undefined;
    throw error;
  });
  await storageReady;
  return connection;
}
