import "server-only";
import { createHmac, randomBytes } from "node:crypto";

export function hashAuthSecret(purpose: "session" | "rate-limit", value: string) {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("Missing or short session secret");
  }

  return createHmac("sha256", secret).update(purpose).update("\0").update(value).digest("hex");
}

export function issueSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function isSessionToken(token: string | undefined): token is string {
  return token !== undefined && /^[A-Za-z0-9_-]{43}$/.test(token);
}
