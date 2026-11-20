import { logOut } from "@/modules/auth/service";
import { authError, authJson, authUnavailable, forbiddenOrigin, sameOrigin } from "@/server/auth/http";
import { readSessionToken, sessionCookieName, sessionCookieOptions } from "@/server/auth/session";

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return forbiddenOrigin();

    const revoked = await logOut(await readSessionToken());
    const response = revoked
      ? authJson({ success: true })
      : authError(401, "UNAUTHENTICATED", "Log in to continue.");
    response.cookies.set(sessionCookieName, "", { ...sessionCookieOptions, maxAge: 0 });
    return response;
  } catch (error) {
    return authUnavailable(error);
  }
}
