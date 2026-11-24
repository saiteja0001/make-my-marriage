import "server-only";
import { setTimeout } from "node:timers/promises";
import { AuthAttempt, connectAuthDatabase } from "./models";
import { hashAuthSecret } from "./secrets";
import { normalizeEmail } from "./validation";

const windowMs = 15 * 60 * 1000;
const clientLimits = { login: 60, signup: 30 };
const signupEmailLimit = 5;
const loginClientEmailLimit = 8;
const failedLoginDelayThreshold = 8;
const failedLoginDelayStepMs = 250;
const maxFailedLoginDelayMs = 2000;

function rateLimitWindow(durationMs = windowMs) {
  const now = Date.now();
  const expiresAt = new Date(now - (now % durationMs) + durationMs);
  return { expiresAt, retryAfter: Math.ceil((expiresAt.getTime() - now) / 1000) };
}

export async function fixedWindowRetryAfter(bucket: string[], limit: number, durationMs: number) {
  await connectAuthDatabase();
  const { expiresAt, retryAfter } = rateLimitWindow(durationMs);
  return await countAttempt(bucket, expiresAt) > limit ? retryAfter : null;
}

async function countAttempt(bucket: string[], expiresAt: Date) {
  const key = hashAuthSecret("rate-limit", JSON.stringify([...bucket, expiresAt]));
  const counter = await AuthAttempt.findOneAndUpdate(
    { _id: key },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
    { upsert: true, returnDocument: "after" },
  ).lean().exec();
  return counter.count;
}

export async function authRetryAfter(action: keyof typeof clientLimits, email: string, client: string | null) {
  const buckets: { key: string[]; limit: number }[] = [];
  if (client !== null) {
    buckets.push({ key: [action, "client", client], limit: clientLimits[action] });
  }

  if (action === "signup") {
    buckets.push({ key: [action, "email", normalizeEmail(email)], limit: signupEmailLimit });
  } else if (client !== null) {
    buckets.push({ key: [action, "client-email", client, normalizeEmail(email)], limit: loginClientEmailLimit });
  }

  if (buckets.length === 0) return null;

  await connectAuthDatabase();
  const { expiresAt, retryAfter } = rateLimitWindow();
  for (const { key, limit } of buckets) {
    if (await countAttempt(key, expiresAt) > limit) return retryAfter;
  }

  return null;
}

export async function delayFailedLogin(email: string) {
  const { expiresAt } = rateLimitWindow();
  const failures = await countAttempt(["login", "failed-email", normalizeEmail(email)], expiresAt);
  const delayMs = Math.min((failures - failedLoginDelayThreshold) * failedLoginDelayStepMs, maxFailedLoginDelayMs);
  if (delayMs > 0) await setTimeout(delayMs);
}
