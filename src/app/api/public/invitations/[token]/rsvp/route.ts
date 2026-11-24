import { RsvpConflict, RsvpPartySizeChanged, RsvpRateLimited, submitGuestRsvp } from "@/modules/guests/invitations";
import { guestInvitationTokenSchema, rsvpSchema } from "@/modules/guests/rsvp-validation";
import { authError, authJson, forbiddenOrigin, readJson, sameOrigin, validationError } from "@/server/auth/http";
import { invitationServiceError, unavailableInvitation } from "../_response";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!sameOrigin(request)) return forbiddenOrigin();
  if (new URL(request.url).searchParams.size) return authError(400, "VALIDATION_ERROR", "RSVPs do not accept query parameters.");
  const token = guestInvitationTokenSchema.safeParse((await params).token);
  if (!token.success) return unavailableInvitation();
  const match = request.headers.get("if-match");
  if (match === null) return authError(428, "REVISION_REQUIRED", "Refresh your invitation before submitting an RSVP.");
  const revision = Number(/^"([0-9]+)"$/.exec(match)?.[1]);
  if (!Number.isSafeInteger(revision)) return authError(400, "VALIDATION_ERROR", "Use a valid RSVP revision.");
  try {
    const body = await readJson(request, "RSVP");
    if (body.error) return body.error;
    const parsed = rsvpSchema.safeParse(body.value);
    if (!parsed.success) return validationError(parsed.error);
    const response = await submitGuestRsvp(token.data, parsed.data, revision);
    return response ? authJson({ data: response }) : unavailableInvitation();
  } catch (error) {
    if (error instanceof RsvpPartySizeChanged) {
      return authError(400, "PARTY_SIZE_CHANGED", error.message, { attendingCount: error.message });
    }
    if (error instanceof RsvpConflict) return authError(409, "CONFLICT", error.message);
    if (error instanceof RsvpRateLimited) {
      const response = authError(429, "RATE_LIMITED", error.message);
      response.headers.set("Retry-After", String(error.retryAfter));
      return response;
    }
    return invitationServiceError(error);
  }
}
