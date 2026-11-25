import { GuestDeliveryProblem, sendGuestInvitation } from "@/modules/guests/delivery";
import { InvitationOriginUnavailable } from "@/modules/guests/invitations";
import { guestIdSchema, sendGuestInvitationSchema } from "@/modules/guests/validation";
import { authError, authJson, readJson, validationError } from "@/server/auth/http";
import { guestNotFound, withGuestAccess } from "../../_request";

export function POST(request: Request, { params }: { params: Promise<{ guestId: string }> }) {
  return withGuestAccess(request, async (weddingId, wedding) => {
    const id = guestIdSchema.safeParse((await params).guestId);
    if (!id.success) return guestNotFound();
    const body = await readJson(request, "invitation");
    if (body.error) return body.error;
    const expected = sendGuestInvitationSchema.safeParse(body.value);
    if (!expected.success) return validationError(expected.error);

    try {
      const invitationSentAt = await sendGuestInvitation(weddingId, id.data, wedding, expected.data);
      return invitationSentAt ? authJson({ success: true, data: { invitationSentAt } }) : guestNotFound();
    } catch (error) {
      if (error instanceof InvitationOriginUnavailable) return authError(503, "INVITATION_UNAVAILABLE", error.message);
      if (!(error instanceof GuestDeliveryProblem)) throw error;
      const response = authError(error.status, error.code, error.message);
      if (error.retryAfter !== undefined) response.headers.set("Retry-After", String(error.retryAfter));
      return response;
    }
  });
}
