import "server-only";
import { Types, type ClientSession } from "mongoose";
import { User } from "@/modules/auth/models";
import { hashAuthSecret, isAuthToken, issueAuthToken } from "@/modules/auth/secrets";
import { normalizeEmail } from "@/modules/auth/validation";
import { connectDatabase } from "@/server/db/mongoose";
import { MemberError } from "./member-errors";
import { connectMemberInvitationStorage, MemberInvitation, type MemberInvitationRecord } from "./member-invitation-model";
import type { MemberRole } from "./member-roles";
import { Wedding, WeddingMembership } from "./models";

const invitationLifetime = 7 * 24 * 60 * 60 * 1000;

type InvitationEmail = {
  id: string;
  email: string;
  token: string;
  weddingName: string;
  role: MemberRole;
};

async function membershipFor(userId: string, adminOnly = false, session?: ClientSession) {
  if (!session) await connectDatabase();
  const membership = await WeddingMembership.findOne({ userId }).select("role weddingId")
    .session(session ?? null).lean().exec();
  if (!membership) throw new MemberError("NOT_FOUND");
  if (adminOnly && membership.role !== "ADMIN") throw new MemberError("FORBIDDEN");
  return membership;
}

async function serializeMemberWrite(weddingId: Types.ObjectId, session: ClientSession) {
  // Concurrent writes to the same wedding retry against a fresh membership and invitation snapshot.
  const result = await Wedding.updateOne({ _id: weddingId }, { $inc: { membershipRevision: 1 } }, {
    session, timestamps: false,
  });
  return result.matchedCount > 0;
}

async function withAdminWrite<Result>(
  userId: string,
  write: (weddingId: Types.ObjectId, session: ClientSession) => Promise<Result>,
) {
  const database = await connectDatabase();
  return database.transaction(async (session) => {
    const { weddingId } = await membershipFor(userId, true, session);
    if (!(await serializeMemberWrite(weddingId, session))) throw new MemberError("NOT_FOUND");
    return write(weddingId, session);
  });
}

function invitationSummary(invite: Pick<MemberInvitationRecord, "email" | "role" | "status" | "expiresAt" | "createdAt"> & {
  _id: Types.ObjectId;
}) {
  return {
    id: invite._id.toString(),
    email: invite.email,
    role: invite.role,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
  };
}

function duplicateKey(error: unknown, field: string) {
  const result = error as { code?: number; keyPattern?: Record<string, number> } | null;
  return result?.code === 11000 && result.keyPattern?.[field] === 1;
}

function tokenHash(token: string) {
  if (!isAuthToken(token)) throw new MemberError("INVALID_TOKEN");
  return hashAuthSecret("member-invitation", token);
}

type InvitationState = Pick<MemberInvitationRecord, "status" | "expiresAt">;

function requirePending(invite: InvitationState | null): asserts invite is InvitationState {
  if (!invite) throw new MemberError("INVALID_TOKEN");
  if (invite.status === "ACCEPTED") throw new MemberError("INVITATION_ALREADY_ACCEPTED");
  if (invite.status === "REVOKED") throw new MemberError("INVITATION_REVOKED");
  if (invite.expiresAt <= new Date()) throw new MemberError("TOKEN_EXPIRED");
}

export async function listWeddingMembers(userId: string) {
  const { weddingId } = await membershipFor(userId);
  const memberships = await WeddingMembership.find({ weddingId }).sort({ role: 1, joinedAt: 1 }).lean().exec();
  const users = await User.find({ _id: { $in: memberships.map((member) => member.userId) } })
    .select("name email").lean().exec();
  const usersById = new Map(users.map(({ _id, name, email }) => [_id.toString(), { id: _id.toString(), name, email }]));
  return memberships.flatMap((membership) => {
    const user = usersById.get(membership.userId.toString());
    return user ? [{
      membershipId: membership._id.toString(),
      user,
      role: membership.role,
      joinedAt: membership.joinedAt.toISOString(),
    }] : [];
  });
}

export async function changeWeddingMembership(userId: string, membershipId: string, role: MemberRole | null) {
  return withAdminWrite(userId, async (weddingId, session) => {
    if (!Types.ObjectId.isValid(membershipId)) throw new MemberError("NOT_FOUND");

    const targetFilter = { _id: membershipId, weddingId };
    const target = await WeddingMembership.findOne(targetFilter).select("role").session(session).lean().exec();
    if (!target) throw new MemberError("NOT_FOUND");

    if (target.role === "ADMIN" && role !== "ADMIN") {
      const anotherAdmin = await WeddingMembership.exists({ weddingId, role: "ADMIN", _id: { $ne: target._id } })
        .session(session);
      if (!anotherAdmin) throw new MemberError("LAST_ADMIN");
    }

    if (role === null) {
      await WeddingMembership.deleteOne(targetFilter, { session });
      return null;
    }
    if (target.role !== role) {
      await WeddingMembership.updateOne(targetFilter, { $set: { role } }, { session, runValidators: true });
    }
    return { membershipId, role };
  });
}

export async function listPendingInvitations(userId: string) {
  const { weddingId } = await membershipFor(userId, true);
  const invitations = await MemberInvitation.find({ weddingId, status: "PENDING", expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 }).lean().exec();
  return invitations.map(invitationSummary);
}

export async function createMemberInvitation(
  userId: string,
  { email, role }: { email: string; role: MemberRole },
  deliver: (invitation: InvitationEmail) => Promise<void>,
) {
  const { weddingId: expectedWeddingId } = await membershipFor(userId, true);
  await connectMemberInvitationStorage();
  const emailNormalized = normalizeEmail(email);
  const token = issueAuthToken();
  const { invite, weddingName } = await withAdminWrite(userId, async (weddingId, session) => {
    if (!weddingId.equals(expectedWeddingId)) throw new MemberError("FORBIDDEN");

    const user = await User.findOne({ emailNormalized }).select("_id").session(session).lean().exec();
    if (user && await WeddingMembership.exists({ weddingId, userId: user._id }).session(session)) {
      throw new MemberError("ALREADY_MEMBER");
    }
    const wedding = await Wedding.findById(weddingId).select("title brideName groomName").session(session).lean().exec();
    if (!wedding) throw new MemberError("NOT_FOUND");

    const now = new Date();
    await MemberInvitation.updateMany({
      weddingId, emailNormalized, status: "PENDING", expiresAt: { $lte: now },
    }, { $set: { status: "REVOKED" } }, { session });

    const invite = new MemberInvitation({
      weddingId,
      email,
      emailNormalized,
      role,
      tokenHash: tokenHash(token),
      status: "PENDING",
      invitedByUserId: userId,
      expiresAt: new Date(now.getTime() + invitationLifetime),
    });
    try {
      await invite.save({ session });
    } catch (error) {
      if (duplicateKey(error, "emailNormalized")) throw new MemberError("INVITATION_PENDING");
      throw error;
    }
    return { invite, weddingName: wedding.title || `${wedding.brideName} & ${wedding.groomName}` };
  });

  try {
    await deliver({
      id: invite._id.toString(),
      email,
      role,
      token,
      weddingName,
    });
  } catch {
    await MemberInvitation.updateOne({ _id: invite._id, status: "PENDING" }, { $set: { status: "REVOKED" } });
    throw new MemberError("DELIVERY_FAILED");
  }
  return invitationSummary(invite);
}

export async function revokeMemberInvitation(userId: string, invitationId: string) {
  await withAdminWrite(userId, async (weddingId, session) => {
    if (!Types.ObjectId.isValid(invitationId)) throw new MemberError("NOT_FOUND");
    const result = await MemberInvitation.updateOne({
      _id: invitationId, weddingId, status: "PENDING", expiresAt: { $gt: new Date() },
    }, { $set: { status: "REVOKED" } }, { session });
    if (result.modifiedCount === 0) throw new MemberError("NOT_FOUND");
  });
}

export async function getPublicMemberInvitation(token: string) {
  const hash = tokenHash(token);
  await connectDatabase();
  const invite = await MemberInvitation.findOne({ tokenHash: hash })
    .select("email role weddingId status expiresAt").lean().exec();
  requirePending(invite);
  const wedding = await Wedding.findById(invite.weddingId)
    .select("title brideName groomName weddingDate").lean().exec();
  if (!wedding) throw new MemberError("INVALID_TOKEN");
  return {
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt.toISOString(),
    wedding: {
      title: wedding.title,
      brideName: wedding.brideName,
      groomName: wedding.groomName,
      weddingDate: wedding.weddingDate,
    },
    requiresLogin: true,
  };
}

export async function acceptMemberInvitation(token: string, user: { id: string; email: string }) {
  const hash = tokenHash(token);
  const database = await connectDatabase();

  try {
    return await database.transaction(async (session) => {
      const invite = await MemberInvitation.findOne({ tokenHash: hash }).session(session).lean().exec();
      requirePending(invite);
      if (normalizeEmail(user.email) !== invite.emailNormalized) throw new MemberError("INVITATION_EMAIL_MISMATCH");
      if (await WeddingMembership.exists({ userId: user.id }).session(session)) {
        throw new MemberError("ALREADY_HAS_WEDDING");
      }
      if (!(await serializeMemberWrite(invite.weddingId, session))) throw new MemberError("INVALID_TOKEN");

      const now = new Date();
      const updated = await MemberInvitation.updateOne(
        { _id: invite._id, status: "PENDING", expiresAt: { $gt: now } },
        { $set: { status: "ACCEPTED", acceptedByUserId: user.id, acceptedAt: now } },
        { session },
      );
      if (updated.modifiedCount === 0) throw new MemberError("TOKEN_EXPIRED");
      await new WeddingMembership({ userId: user.id, weddingId: invite.weddingId, role: invite.role, joinedAt: now })
        .save({ session });
      return { weddingId: invite.weddingId.toString(), role: invite.role };
    });
  } catch (error) {
    if (duplicateKey(error, "userId")) throw new MemberError("ALREADY_HAS_WEDDING");
    throw error;
  }
}
