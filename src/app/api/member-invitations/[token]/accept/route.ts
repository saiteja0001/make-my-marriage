import { acceptMemberInvitation } from "@/modules/wedding/member-service";
import { authError, authJson, forbiddenOrigin, sameOrigin } from "@/server/auth/http";
import { getSignedInUser } from "@/server/auth/session";
import { memberErrorResponse } from "@/server/http/member-response";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    if (!sameOrigin(request)) return forbiddenOrigin();
    const user = await getSignedInUser();
    if (!user) return authError(401, "UNAUTHENTICATED", "Log in to accept the invitation.");
    const { token } = await params;
    return authJson({ data: await acceptMemberInvitation(token, user) });
  } catch (error) {
    return memberErrorResponse(error);
  }
}
