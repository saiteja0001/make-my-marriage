import { PhotoProblem } from "@/modules/photos/service";
import { authError } from "@/server/auth/http";

export function unavailableGallery() {
  return authError(404, "NOT_FOUND", "This gallery is unavailable.");
}

export function galleryServiceError(error: unknown) {
  if (error instanceof PhotoProblem) return authError(error.status, error.code, error.message);
  console.error("Guest gallery operation failed", error instanceof Error ? error.name : "UnknownError");
  return authError(503, "GALLERY_UNAVAILABLE", "The gallery is temporarily unavailable. Try again.");
}
