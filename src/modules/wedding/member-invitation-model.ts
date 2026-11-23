import "server-only";
import { model, models, Schema, type Model, type Types } from "mongoose";
import { connectWeddingStorage } from "./models";
import { memberRoles, type MemberRole } from "./member-roles";

export type MemberInvitationRecord = {
  weddingId: Types.ObjectId;
  email: string;
  emailNormalized: string;
  role: MemberRole;
  tokenHash: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED";
  invitedByUserId: Types.ObjectId;
  acceptedByUserId?: Types.ObjectId;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
};

const schema = new Schema<MemberInvitationRecord>({
  weddingId: { type: Schema.Types.ObjectId, required: true },
  email: { type: String, required: true },
  emailNormalized: { type: String, required: true, index: true },
  role: { type: String, enum: memberRoles, required: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  status: { type: String, enum: ["PENDING", "ACCEPTED", "REVOKED"], required: true },
  invitedByUserId: { type: Schema.Types.ObjectId, required: true },
  acceptedByUserId: Schema.Types.ObjectId,
  expiresAt: { type: Date, required: true, index: true },
  acceptedAt: Date,
}, { autoCreate: false, autoIndex: false, timestamps: true });

schema.index({ weddingId: 1, status: 1 });
schema.index({ weddingId: 1, emailNormalized: 1 }, {
  unique: true,
  partialFilterExpression: { status: "PENDING" },
});

export const MemberInvitation: Model<MemberInvitationRecord> = models.WeddingMemberInvitation
  ?? model("WeddingMemberInvitation", schema, "wedding_member_invitations");

let ready: Promise<void> | undefined;

async function provisionInvitations() {
  await MemberInvitation.createCollection();
  await MemberInvitation.createIndexes();
}

export async function connectMemberInvitationStorage() {
  const database = await connectWeddingStorage();
  ready ??= provisionInvitations().catch((error: unknown) => {
    ready = undefined;
    throw error;
  });
  await ready;
  return database;
}
