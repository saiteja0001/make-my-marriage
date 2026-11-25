import { getGuestInvitationPreview } from "@/modules/guests/delivery";
import { InvitationOriginUnavailable } from "@/modules/guests/invitations";
import { guestIdSchema } from "@/modules/guests/validation";
import { authError, authJson } from "@/server/auth/http";
import { guestNotFound, withGuestAccess } from "../../_request";

export function GET(request: Request, { params }: { params: Promise<{ guestId: string }> }) {
  return withGuestAccess(request, async (weddingId, wedding) => {
    const id = guestIdSchema.safeParse((await params).guestId);
    if (!id.success) return guestNotFound();
    try {
      const preview = await getGuestInvitationPreview(weddingId, id.data, wedding);
      if (!preview) return guestNotFound();
      const response = authJson({ data: preview });
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } catch (error) {
      if (error instanceof InvitationOriginUnavailable) return authError(503, "INVITATION_UNAVAILABLE", error.message);
      throw error;
    }
  });
}
