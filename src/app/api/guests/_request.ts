import { GuestCapacityConflict, GuestConflict, GuestCreationGone, GuestEventUnavailable, guestDraftContext } from "@/modules/guests/service";
import { getWeddingForUser } from "@/modules/wedding/service";
import { authError, forbiddenOrigin, sameOrigin } from "@/server/auth/http";
import { getSignedInUser } from "@/server/auth/session";

export function guestNotFound() {
  return authError(404, "NOT_FOUND", "Guest group not found.");
}

export async function withGuestAccess(request: Request, handle: (weddingId: string) => Promise<Response>) {
  const mutation = request.method !== "GET" && request.method !== "HEAD";
  if (mutation && !sameOrigin(request)) return forbiddenOrigin();
  try {
    const user = await getSignedInUser();
    if (!user) return authError(401, "UNAUTHENTICATED", "Log in to continue.");
    const current = await getWeddingForUser(user.id);
    if (!current) return authError(404, "NOT_FOUND", "Wedding not found.");
    const weddingId = current.wedding.id;
    const draft = request.headers.get("x-guest-draft");
    if (mutation && draft !== null && draft !== guestDraftContext(current.membershipId, weddingId)) {
      return authError(409, "DRAFT_CHANGED", "Your account or wedding changed. Reopen the guest form before saving.");
    }
    return await handle(weddingId);
  } catch (error) {
    if (error instanceof GuestConflict) return authError(409, "CONFLICT", error.message);
    if (error instanceof GuestCapacityConflict) return authError(409, "CAPACITY_CONFLICT", error.message, { maxGuests: error.message });
    if (error instanceof GuestCreationGone) return authError(410, "GUEST_DELETED", error.message);
    if (error instanceof GuestEventUnavailable) {
      return authError(404, "NOT_FOUND", error.message, { invitedEventIds: error.message });
    }
    console.error("Guest operation failed", error instanceof Error ? error.name : "UnknownError");
    return authError(503, "INTERNAL_ERROR", "Guest details are temporarily unavailable. Please try again.");
  }
}
