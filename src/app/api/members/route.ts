import { listWeddingMembers } from "@/modules/wedding/member-service";
import { authError, authJson } from "@/server/auth/http";
import { getSignedInUser } from "@/server/auth/session";
import { memberErrorResponse } from "@/server/http/member-response";

export async function GET() {
  try {
    const user = await getSignedInUser();
    if (!user) return authError(401, "UNAUTHENTICATED", "Log in to continue.");
    return authJson({ data: await listWeddingMembers(user.id) });
  } catch (error) {
    return memberErrorResponse(error);
  }
}
