import { getWeddingForUser } from "@/modules/wedding/service";
import { authError, authJson, authUnavailable } from "@/server/auth/http";
import { getSignedInUser } from "@/server/auth/session";

export async function GET() {
  try {
    const user = await getSignedInUser();
    if (!user) return authError(401, "UNAUTHENTICATED", "Log in to continue.");

    const current = await getWeddingForUser(user.id);
    const wedding = current?.wedding;
    return authJson({ data: {
      user,
      membership: current?.membership ?? null,
      wedding: wedding ? {
        id: wedding.id,
        brideName: wedding.brideName,
        groomName: wedding.groomName,
        weddingDate: wedding.weddingDate,
      } : null,
    } });
  } catch (error) {
    return authUnavailable(error);
  }
}
