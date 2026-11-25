import "server-only";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { authRetryAfter } from "@/modules/auth/rate-limit";
import { AuthError } from "@/modules/auth/service";
import { sessionCookieName, sessionCookieOptions } from "./session";

const maxBodyBytes = 8192;

export function authJson(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function authError(
  status: number,
  code: string,
  message: string,
  details?: Record<string, string>,
) {
  return authJson({ error: { code, message, details } }, status);
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) return origin === new URL(configuredUrl).origin;

  // Next.js can normalize the URL's local hostname while preserving the browser's Host header.
  const host = request.headers.get("host")?.toLowerCase();
  return Boolean(host && origin === new URL(request.url).protocol + "//" + host);
}

export function forbiddenOrigin() {
  return authError(403, "FORBIDDEN", "This request must come from Make My Marriage.");
}

export function authUnavailable(error: unknown) {
  console.error("Account operation failed", error instanceof Error ? error.name : "UnknownError");
  return authError(503, "INTERNAL_ERROR", "Account access is temporarily unavailable. Please try again.");
}

export async function readJson(request: Request, subject: "account" | "wedding" | "invitation" | "member" | "event" | "task" | "guest" | "RSVP" | "photo" | "gallery" | "expense" | "vendor") {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return { error: authError(415, "VALIDATION_ERROR", `Send the ${subject} details as JSON.`) };
  }
  const reader = request.body?.getReader();
  if (!reader) return { error: authError(400, "VALIDATION_ERROR", `Enter your ${subject} details.`) };

  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBodyBytes) {
        await reader.cancel().catch(() => {});
        const label = subject[0].toUpperCase() + subject.slice(1);
        return { error: authError(413, "VALIDATION_ERROR", `${label} details are too large.`) };
      }
      body += decoder.decode(value, { stream: true });
    }
    const value: unknown = JSON.parse(body + decoder.decode());
    return { value };
  } catch {
    return { error: authError(400, "VALIDATION_ERROR", `Enter valid ${subject} details.`) };
  } finally {
    reader.releaseLock();
  }
}

export function validationError(error: z.ZodError) {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    if (field) details[field] ??= issue.message;
  }
  return authError(400, "VALIDATION_ERROR", "Check the highlighted fields.", details);
}

export function rateLimitClient(request: Request) {
  // Only accept the forwarding header when it comes from the deployment platform.
  const address = process.env.VERCEL === "1" && request.headers.get("x-vercel-forwarded-for");
  return address && isIP(address) ? address : null;
}

type Credentials = { email: string; password: string };
type SignedInAccount = {
  user: { id: string; name: string; email: string };
  token: string;
  expiresAt: Date;
  hasWedding: boolean;
};

export async function handleCredentials<T extends Credentials>(
  request: Request,
  action: "signup" | "login",
  schema: z.ZodType<T>,
  authenticate: (input: T) => Promise<SignedInAccount>,
) {
  try {
    if (!sameOrigin(request)) return forbiddenOrigin();

    const body = await readJson(request, "account");
    if (body.error) return body.error;
    const parsed = schema.safeParse(body.value);
    if (!parsed.success) return validationError(parsed.error);

    const retryAfter = await authRetryAfter(action, parsed.data.email, rateLimitClient(request));
    if (retryAfter !== null) {
      const response = authError(429, "RATE_LIMITED", "Too many attempts. Please try again later.");
      response.headers.set("Retry-After", String(retryAfter));
      return response;
    }

    const account = await authenticate(parsed.data);
    const response = authJson({
      data: { user: account.user, hasWedding: account.hasWedding },
    }, action === "signup" ? 201 : 200);
    response.cookies.set(sessionCookieName, account.token, {
      ...sessionCookieOptions,
      expires: account.expiresAt,
    });
    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.code === "EMAIL_ALREADY_EXISTS") {
        return authError(409, error.code, "An account already exists for this email.", {
          email: "This email is already registered.",
        });
      }
      return authError(401, error.code, "Invalid email or password.");
    }
    return authUnavailable(error);
  }
}
