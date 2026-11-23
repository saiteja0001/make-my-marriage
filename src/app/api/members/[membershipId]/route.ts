import { changeWeddingMembership } from "@/modules/wedding/member-service";
import { changeMemberRoleSchema } from "@/modules/wedding/member-validation";
import { authError, authJson, forbiddenOrigin, readJson, sameOrigin, validationError } from "@/server/auth/http";
import { getSignedInUser } from "@/server/auth/session";
import { memberErrorResponse } from "@/server/http/member-response";

type MemberContext = { params: Promise<{ membershipId: string }> };

export async function PATCH(request: Request, { params }: MemberContext) {
  try {
    if (!sameOrigin(request)) return forbiddenOrigin();
    const user = await getSignedInUser();
    if (!user) return authError(401, "UNAUTHENTICATED", "Log in to continue.");

    const body = await readJson(request, "member");
    if (body.error) return body.error;
    const parsed = changeMemberRoleSchema.safeParse(body.value);
    if (!parsed.success) return validationError(parsed.error);

    const { membershipId } = await params;
    const member = await changeWeddingMembership(user.id, membershipId, parsed.data.role);
    return authJson({ data: member });
  } catch (error) {
    return memberErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: MemberContext) {
  try {
    if (!sameOrigin(request)) return forbiddenOrigin();
    const user = await getSignedInUser();
    if (!user) return authError(401, "UNAUTHENTICATED", "Log in to continue.");

    const { membershipId } = await params;
    await changeWeddingMembership(user.id, membershipId, null);
    return authJson({ success: true });
  } catch (error) {
    return memberErrorResponse(error);
  }
}
