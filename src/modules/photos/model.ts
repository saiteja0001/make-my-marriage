import "server-only";
import { model, models, Schema, type Model, type Types } from "mongoose";
import { connectDatabase } from "@/server/db/mongoose";
import { maxPhotoBytes, photoTypes, type PhotoMime } from "./validation";

const photoStatuses = ["PENDING", "READY", "DELETED"] as const;
export type PhotoRecord = {
  _id: Types.ObjectId;
  weddingId: Types.ObjectId;
  uploadedByMembershipId: Types.ObjectId;
  uploaderType: "MEMBER";
  eventId?: Types.ObjectId;
  originalFilename: string;
  mimeType: PhotoMime;
  sizeBytes: number;
  uploadKey: string;
  objectKey: string;
  status: (typeof photoStatuses)[number];
  expiresAt: Date;
  createdAt: Date;
};

const schema = new Schema<PhotoRecord>({
  weddingId: { type: Schema.Types.ObjectId, required: true },
  uploadedByMembershipId: { type: Schema.Types.ObjectId, required: true },
  uploaderType: { type: String, required: true, enum: ["MEMBER"], default: "MEMBER" },
  eventId: Schema.Types.ObjectId,
  originalFilename: { type: String, required: true, maxlength: 200 },
  mimeType: { type: String, required: true, enum: photoTypes },
  sizeBytes: { type: Number, required: true, min: 1, max: maxPhotoBytes },
  uploadKey: { type: String, required: true, unique: true },
  objectKey: { type: String, required: true, unique: true },
  status: { type: String, required: true, enum: photoStatuses },
  expiresAt: { type: Date, required: true },
}, { timestamps: true, autoCreate: false, autoIndex: false });

schema.index({ weddingId: 1, status: 1, createdAt: -1, _id: -1 });
schema.index({ weddingId: 1, status: 1, eventId: 1, createdAt: -1, _id: -1 });

export const WeddingPhoto: Model<PhotoRecord> = models.WeddingPhoto ?? model<PhotoRecord>("WeddingPhoto", schema, "photos");

let storageReady: Promise<unknown> | undefined;
export async function preparePhotoStorage() {
  const connection = await connectDatabase();
  storageReady ??= WeddingPhoto.createIndexes().catch((error: unknown) => {
    storageReady = undefined;
    throw error;
  });
  await storageReady;
  return connection;
}
