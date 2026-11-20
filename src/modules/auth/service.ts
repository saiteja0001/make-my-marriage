import "server-only";
import { argon2id, hash, verify } from "argon2";
import type { Types } from "mongoose";
import { connectAuthDatabase, Session, User } from "./models";
import { delayFailedLogin } from "./rate-limit";
import { hashAuthSecret, isSessionToken, issueSessionToken } from "./secrets";
import { normalizeEmail } from "./validation";

const sessionLifetime = 7 * 24 * 60 * 60 * 1000;
const passwordCost = { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

// A valid Argon2id digest keeps the verification cost similar for absent accounts.
const dummyPasswordHash = "$argon2id$v=19$m=19456,t=2,p=1$T9kwL+h2n4oGn8hJjDMTeQ$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

type AccountInput = { email: string; password: string };
type UserIdentity = { _id: Types.ObjectId; name: string; email: string };

export class AuthError extends Error {
  constructor(public readonly code: "EMAIL_ALREADY_EXISTS" | "INVALID_CREDENTIALS") {
    super(code);
  }
}

function publicUser(user: UserIdentity) {
  return { id: user._id.toString(), name: user.name, email: user.email };
}

function newSession() {
  const token = issueSessionToken();
  const expiresAt = new Date(Date.now() + sessionLifetime);
  return { token, expiresAt, tokenHash: hashAuthSecret("session", token) };
}

function isDuplicateEmail(error: unknown) {
  const candidate = error as { code?: number; keyPattern?: { emailNormalized?: number } } | null;
  return candidate?.code === 11000 && candidate.keyPattern?.emailNormalized === 1;
}

export async function signUp(input: AccountInput & { name: string }) {
  const connection = await connectAuthDatabase();
  const passwordHash = await hash(input.password, passwordCost);
  const { token, expiresAt, tokenHash } = newSession();

  try {
    const user = await connection.transaction(async (transaction) => {
      const user = new User({
        name: input.name,
        email: input.email,
        emailNormalized: normalizeEmail(input.email),
        passwordHash,
      });
      await user.save({ session: transaction });
      await new Session({ userId: user._id, expiresAt, tokenHash }).save({ session: transaction });
      return publicUser(user);
    });
    return { user, token, expiresAt };
  } catch (error) {
    if (isDuplicateEmail(error)) throw new AuthError("EMAIL_ALREADY_EXISTS");
    throw error;
  }
}

export async function logIn(input: AccountInput) {
  await connectAuthDatabase();
  const user = await User.findOne({ emailNormalized: normalizeEmail(input.email) })
    .select("name email +passwordHash")
    .lean()
    .exec();
  const valid = await verify(user?.passwordHash ?? dummyPasswordHash, input.password);
  if (!user || !valid) {
    await delayFailedLogin(input.email);
    throw new AuthError("INVALID_CREDENTIALS");
  }

  const { token, expiresAt, tokenHash } = newSession();
  await Session.create({ userId: user._id, expiresAt, tokenHash });
  return { user: publicUser(user), token, expiresAt };
}

function activeSession(token: string) {
  return { tokenHash: hashAuthSecret("session", token), expiresAt: { $gt: new Date() } };
}

export async function findSignedInUser(token: string | undefined) {
  if (!isSessionToken(token)) return null;
  await connectAuthDatabase();

  const session = await Session.findOne(activeSession(token)).select("userId").lean().exec();
  if (!session) return null;

  const user = await User.findById(session.userId).select("name email").lean().exec();
  return user ? publicUser(user) : null;
}

export async function logOut(token: string | undefined) {
  if (!isSessionToken(token)) return false;
  await connectAuthDatabase();
  const result = await Session.deleteOne(activeSession(token));
  return result.deletedCount === 1;
}
