import { vendorDraftContext, VendorProblem } from "@/modules/vendors/service";
import { getWeddingForUser } from "@/modules/wedding/service";
import { authError, forbiddenOrigin, sameOrigin } from "@/server/auth/http";
import { getSignedInUser } from "@/server/auth/session";

export function vendorNotFound() {
  return authError(404, "NOT_FOUND", "Vendor not found.");
}

export function vendorRevision(request: Request) {
  const header = request.headers.get("if-match");
  if (header === null) return undefined;
  const revision = Number(/^"(0|[1-9][0-9]*)"$/.exec(header)?.[1]);
  if (!Number.isSafeInteger(revision)) throw new VendorProblem(400, "VALIDATION_ERROR", "Use a valid vendor revision.");
  return revision;
}

export async function withVendorAccess(request: Request, action: (weddingId: string, weddingLocation: string) => Promise<Response>) {
  const mutation = request.method !== "GET" && request.method !== "HEAD";
  if (mutation && !sameOrigin(request)) return forbiddenOrigin();
  try {
    const user = await getSignedInUser();
    if (!user) return authError(401, "UNAUTHENTICATED", "Sign in to continue.");
    const current = await getWeddingForUser(user.id);
    const draft = request.headers.get("x-vendor-draft");
    if (draft !== null && (!current || draft !== vendorDraftContext(current.wedding.id, current.membershipId))) {
      return authError(409, "DRAFT_CHANGED", "Your account or wedding changed. Reopen My Vendors to continue.");
    }
    if (!current) return authError(404, "NOT_FOUND", "Wedding not found.");
    const { wedding, membership } = current;
    if (!["ADMIN", "MANAGER"].includes(membership.role)) return authError(403, "FORBIDDEN", "You do not have access to wedding vendors.");
    return await action(wedding.id, wedding.location.formattedAddress);
  } catch (error) {
    if (error instanceof VendorProblem) {
      const response = authError(error.status, error.code, error.message, error.details);
      if (error.retryAfter) response.headers.set("Retry-After", String(error.retryAfter));
      return response;
    }
    console.error("Vendor operation failed", error instanceof Error ? error.name : "UnknownError");
    return authError(503, "VENDORS_UNAVAILABLE", "Vendors are temporarily unavailable. Try again.");
  }
}
