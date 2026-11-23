import { createMemberInvitationSchema } from "@/modules/wedding/member-validation";
import { createMemberInvitation, listPendingInvitations } from "@/modules/wedding/member-service";
import { authError, authJson, forbiddenOrigin, readJson, sameOrigin, validationError } from "@/server/auth/http";
import { getSignedInUser } from "@/server/auth/session";
import { sendMemberInvitationEmail } from "@/server/email/member-invitation";
import { memberErrorResponse } from "@/server/http/member-response";

export async function GET() {
  try {
    const user = await getSignedInUser();
    if (!user) return authError(401, "UNAUTHENTICATED", "Log in to continue.");
    return authJson({ data: await listPendingInvitations(user.id) });
  } catch (error) {
    return memberErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return forbiddenOrigin();
    const user = await getSignedInUser();
    if (!user) return authError(401, "UNAUTHENTICATED", "Log in to continue.");
    const body = await readJson(request, "invitation");
    if (body.error) return body.error;
    const parsed = createMemberInvitationSchema.safeParse(body.value);
    if (!parsed.success) return validationError(parsed.error);

    const invitation = await createMemberInvitation(user.id, parsed.data, sendMemberInvitationEmail);
    return authJson({ data: invitation }, 201);
  } catch (error) {
    return memberErrorResponse(error);
  }
}
