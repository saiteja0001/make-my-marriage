import "server-only";
import { model, models, Schema, type Model, type Types } from "mongoose";
import { connectDatabase } from "@/server/db/mongoose";

type UserRecord = {
  name: string;
  email: string;
  emailNormalized: string;
  passwordHash: string;
};

type SessionRecord = {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
};

type AuthAttempt = {
  _id: string;
  count: number;
  expiresAt: Date;
};

const explicitStorageSetup = { autoCreate: false, autoIndex: false } as const;

const userSchema = new Schema<UserRecord>({
  name: { type: String, required: true },
  email: { type: String, required: true },
  emailNormalized: { type: String, required: true, unique: true, select: false },
  passwordHash: { type: String, required: true, select: false },
}, { ...explicitStorageSetup, timestamps: true });

const sessionSchema = new Schema<SessionRecord>({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true },
}, { ...explicitStorageSetup, timestamps: { createdAt: true, updatedAt: false } });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const attemptSchema = new Schema<AuthAttempt>({
  _id: { type: String, required: true },
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
}, explicitStorageSetup);
attemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const User: Model<UserRecord> = models.User ?? model("User", userSchema, "users");
export const Session: Model<SessionRecord> = models.Session ?? model("Session", sessionSchema, "sessions");
export const AuthAttempt: Model<AuthAttempt> = models.AuthAttempt ?? model("AuthAttempt", attemptSchema, "auth_rate_limits");

let authStorageReady: Promise<void> | undefined;

async function provisionAuthStorage() {
  for (const authModel of [User, Session, AuthAttempt]) {
    await authModel.createCollection();
    await authModel.createIndexes();
  }
}

export async function connectAuthDatabase() {
  const connection = await connectDatabase();
  // Mongoose retains a rejected Model.init() promise. Let the next request retry setup.
  authStorageReady ??= provisionAuthStorage().catch((error: unknown) => {
    authStorageReady = undefined;
    throw error;
  });
  await authStorageReady;
  return connection;
}
