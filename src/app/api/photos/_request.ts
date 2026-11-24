import { photoDraftContext, PhotoProblem, type PhotoScope } from "@/modules/photos/service";
import { getWeddingForUser } from "@/modules/wedding/service";
import { authError, forbiddenOrigin, sameOrigin } from "@/server/auth/http";
import { getSignedInUser } from "@/server/auth/session";
import { R2ObjectChanged, R2ObjectMissing, R2Unavailable } from "@/server/storage/r2";

export function photoNotFound() {
  return authError(404, "NOT_FOUND", "Photo not found.");
}

export async function withPhotoAccess(request: Request, handle: (scope: PhotoScope) => Promise<Response>) {
  const mutation = request.method !== "GET" && request.method !== "HEAD";
  if (mutation && !sameOrigin(request)) return forbiddenOrigin();
  try {
    const user = await getSignedInUser();
    if (!user) return authError(401, "UNAUTHENTICATED", "Log in to continue.");
    const current = await getWeddingForUser(user.id);
    if (!current) return authError(404, "NOT_FOUND", "Wedding not found.");
    const scope = { weddingId: current.wedding.id, membershipId: current.membershipId };
    const draft = request.headers.get("x-photo-draft");
    if (draft !== null && draft !== photoDraftContext(scope)) {
      return authError(409, "DRAFT_CHANGED", "Your account or wedding changed. Reopen the gallery to select photos for this wedding.");
    }
    return await handle(scope);
  } catch (error) {
    if (error instanceof PhotoProblem) {
      const response = authError(error.status, error.code, error.message);
      if (error.retryAfter) response.headers.set("Retry-After", String(error.retryAfter));
      return response;
    }
    if (error instanceof R2Unavailable || error instanceof R2ObjectChanged || error instanceof R2ObjectMissing) {
      return authError(503, "STORAGE_UNAVAILABLE", "Photo storage is temporarily unavailable. Try again.");
    }
    console.error("Photo operation failed", error instanceof Error ? error.name : "UnknownError");
    return authError(503, "INTERNAL_ERROR", "Photos are temporarily unavailable. Try again.");
  }
}
