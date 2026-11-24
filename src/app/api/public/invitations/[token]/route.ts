import { getPublicInvitation } from "@/modules/guests/invitations";
import { authError, authJson } from "@/server/auth/http";
import { invitationServiceError, unavailableInvitation } from "./_response";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (new URL(request.url).searchParams.size) return authError(400, "VALIDATION_ERROR", "This invitation does not accept query parameters.");
  try {
    const invitation = await getPublicInvitation((await params).token);
    return invitation ? authJson({ data: invitation }) : unavailableInvitation();
  } catch (error) {
    return invitationServiceError(error);
  }
}
