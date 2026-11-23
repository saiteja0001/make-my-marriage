import { getPublicMemberInvitation } from "@/modules/wedding/member-service";
import { authJson } from "@/server/auth/http";
import { memberErrorResponse } from "@/server/http/member-response";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    return authJson({ data: await getPublicMemberInvitation(token) });
  } catch (error) {
    return memberErrorResponse(error);
  }
}
