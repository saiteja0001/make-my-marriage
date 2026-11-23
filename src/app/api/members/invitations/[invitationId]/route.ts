import { revokeMemberInvitation } from "@/modules/wedding/member-service";
import { authError, authJson, forbiddenOrigin, sameOrigin } from "@/server/auth/http";
import { getSignedInUser } from "@/server/auth/session";
import { memberErrorResponse } from "@/server/http/member-response";

export async function DELETE(request: Request, { params }: { params: Promise<{ invitationId: string }> }) {
  try {
    if (!sameOrigin(request)) return forbiddenOrigin();
    const user = await getSignedInUser();
    if (!user) return authError(401, "UNAUTHENTICATED", "Log in to continue.");
    const { invitationId } = await params;
    await revokeMemberInvitation(user.id, invitationId);
    return authJson({ success: true });
  } catch (error) {
    return memberErrorResponse(error);
  }
}
