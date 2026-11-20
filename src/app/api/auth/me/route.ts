import { authError, authJson, authUnavailable } from "@/server/auth/http";
import { getSignedInUser } from "@/server/auth/session";

export async function GET() {
  try {
    const user = await getSignedInUser();
    if (!user) return authError(401, "UNAUTHENTICATED", "Log in to continue.");

    return authJson({ data: { user, membership: null, wedding: null } });
  } catch (error) {
    return authUnavailable(error);
  }
}
