import "server-only";
import { model, models, Schema, type Model, type Types } from "mongoose";
import { connectDatabase } from "@/server/db/mongoose";
import { memberRoles, type MemberRole } from "./member-roles";

type WeddingRecord = {
  brideName: string;
  groomName: string;
  title?: string;
  description?: string;
  weddingDate: string;
  timeZone: string;
  location: { formattedAddress: string };
  website: { slug: string; isPublished: boolean };
  gallery?: { tokenHash: string; encryptedToken: string; isEnabled: boolean };
  createdByUserId: Types.ObjectId;
  membershipRevision?: number;
};

type MembershipRecord = {
  userId: Types.ObjectId;
  weddingId: Types.ObjectId;
  role: MemberRole;
  joinedAt: Date;
  taskReferenceRevision?: number;
};

const storageOptions = { autoCreate: false, autoIndex: false, timestamps: true } as const;
const gallerySchema = new Schema<NonNullable<WeddingRecord["gallery"]>>({
  tokenHash: { type: String, required: true },
  encryptedToken: { type: String, required: true },
  isEnabled: { type: Boolean, required: true },
}, { _id: false });

const weddingSchema = new Schema<WeddingRecord>({
  brideName: { type: String, required: true },
  groomName: { type: String, required: true },
  title: String,
  description: String,
  weddingDate: { type: String, required: true },
  timeZone: { type: String, required: true },
  location: { formattedAddress: { type: String, required: true } },
  website: {
    slug: { type: String, required: true, unique: true },
    isPublished: { type: Boolean, default: false },
  },
  gallery: { type: gallerySchema, select: false },
  createdByUserId: { type: Schema.Types.ObjectId, required: true },
  membershipRevision: Number,
}, storageOptions);
weddingSchema.index({ "gallery.tokenHash": 1 }, { unique: true, sparse: true });

const membershipSchema = new Schema<MembershipRecord>({
  userId: { type: Schema.Types.ObjectId, required: true, unique: true },
  weddingId: { type: Schema.Types.ObjectId, required: true },
  role: { type: String, enum: memberRoles, required: true },
  joinedAt: { type: Date, required: true },
  taskReferenceRevision: Number,
}, storageOptions);
membershipSchema.index({ weddingId: 1, userId: 1 }, { unique: true });

export const Wedding: Model<WeddingRecord> = models.Wedding ?? model("Wedding", weddingSchema, "weddings");
export const WeddingMembership: Model<MembershipRecord> = models.WeddingMembership
  ?? model("WeddingMembership", membershipSchema, "wedding_memberships");

let weddingStorageReady: Promise<void> | undefined;

async function provisionWeddingStorage() {
  for (const weddingModel of [Wedding, WeddingMembership]) {
    await weddingModel.createCollection();
    await weddingModel.createIndexes();
  }
}

export async function connectWeddingStorage() {
  const connection = await connectDatabase();
  weddingStorageReady ??= provisionWeddingStorage().catch((error: unknown) => {
    weddingStorageReady = undefined;
    throw error;
  });
  await weddingStorageReady;
  return connection;
}
