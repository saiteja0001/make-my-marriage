import { PhotoProblem, type GuestPhotoScope } from "@/modules/photos/service";
import { guestPhotoScope } from "@/modules/photos/sharing";
import { authError, forbiddenOrigin, rateLimitClient, sameOrigin } from "@/server/auth/http";

export function unavailableGallery() {
  return authError(404, "NOT_FOUND", "This gallery is unavailable.");
}

export function galleryServiceError(error: unknown) {
  if (error instanceof PhotoProblem) {
    const response = authError(error.status, error.code, error.message);
    if (error.retryAfter) response.headers.set("Retry-After", String(error.retryAfter));
    return response;
  }
  console.error("Guest gallery operation failed", error instanceof Error ? error.name : "UnknownError");
  return authError(503, "GALLERY_UNAVAILABLE", "The gallery is temporarily unavailable. Try again.");
}

export async function withGuestUpload(request: Request, token: string, handle: (scope: GuestPhotoScope) => Promise<Response>) {
  if (!sameOrigin(request)) return forbiddenOrigin();
  try {
    const scope = await guestPhotoScope(token, rateLimitClient(request));
    return scope ? await handle(scope) : unavailableGallery();
  } catch (error) {
    return galleryServiceError(error);
  }
}
