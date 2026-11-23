import { EventConflict, eventDraftContext, InvalidEventRange } from "@/modules/events/service";
import { getWeddingForUser } from "@/modules/wedding/service";
import { authError, forbiddenOrigin, sameOrigin } from "@/server/auth/http";
import { getSignedInUser } from "@/server/auth/session";

export function eventNotFound() {
  return authError(404, "NOT_FOUND", "Event not found.");
}

export async function withEventAccess(request: Request, handle: (weddingId: string) => Promise<Response>) {
  const mutation = request.method !== "GET" && request.method !== "HEAD";
  if (mutation && !sameOrigin(request)) return forbiddenOrigin();

  try {
    const user = await getSignedInUser();
    if (!user) return authError(401, "UNAUTHENTICATED", "Log in to continue.");
    const current = await getWeddingForUser(user.id);
    if (!current) return authError(404, "NOT_FOUND", "Wedding not found.");

    const { id, timeZone } = current.wedding;
    const draft = request.headers.get("x-event-draft");
    if (mutation && draft !== null && draft !== eventDraftContext(user.id, id, timeZone)) {
      return authError(409, "DRAFT_CHANGED", "Your account, wedding, or wedding timezone changed. Reopen the event before saving.");
    }
    return await handle(id);
  } catch (error) {
    if (error instanceof InvalidEventRange) {
      return authError(400, "VALIDATION_ERROR", "Check the highlighted fields.", { endsAt: error.message });
    }
    if (error instanceof EventConflict) return authError(409, "CONFLICT", error.message);
    console.error("Event operation failed", error instanceof Error ? error.name : "UnknownError");
    return authError(503, "INTERNAL_ERROR", "Events are temporarily unavailable. Please try again.");
  }
}
