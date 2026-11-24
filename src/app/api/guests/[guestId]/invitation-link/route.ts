import { getGuestInvitationLink, InvitationOriginUnavailable } from "@/modules/guests/invitations";
import { guestIdSchema } from "@/modules/guests/validation";
import { authError, authJson } from "@/server/auth/http";
import { guestNotFound, withGuestAccess } from "../../_request";

export function GET(request: Request, { params }: { params: Promise<{ guestId: string }> }) {
  return withGuestAccess(request, async (weddingId) => {
    const id = guestIdSchema.safeParse((await params).guestId);
    if (!id.success) return guestNotFound();
    try {
      const url = await getGuestInvitationLink(weddingId, id.data);
      if (!url) return guestNotFound();
      const response = authJson({ data: { url } });
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } catch (error) {
      if (error instanceof InvitationOriginUnavailable) return authError(503, "INVITATION_UNAVAILABLE", error.message);
      throw error;
    }
  });
}
