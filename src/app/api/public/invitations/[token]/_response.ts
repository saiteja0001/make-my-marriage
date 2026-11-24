import { authError } from "@/server/auth/http";

export function unavailableInvitation() {
  return authError(404, "NOT_FOUND", "This invitation is unavailable. Ask your hosts for the invitation link.");
}

export function invitationServiceError(error: unknown) {
  console.error("Guest invitation operation failed", error instanceof Error ? error.name : "UnknownError");
  return authError(503, "INTERNAL_ERROR", "The invitation is temporarily unavailable. Please try again.");
}
