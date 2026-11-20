import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { findSignedInUser } from "@/modules/auth/service";

export const sessionCookieName = "mmm_session";

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

export async function readSessionToken() {
  return (await cookies()).get(sessionCookieName)?.value;
}

export const getSignedInUser = cache(async () => findSignedInUser(await readSessionToken()));
