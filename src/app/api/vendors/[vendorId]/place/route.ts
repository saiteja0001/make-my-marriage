import { savedVendorListing } from "@/modules/vendors/discovery";
import { vendorIdSchema } from "@/modules/vendors/validation";
import { authError, authJson, forbiddenOrigin } from "@/server/auth/http";
import { withVendorAccess } from "../../_request";

export async function GET(request: Request, { params }: { params: Promise<{ vendorId: string }> }) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return forbiddenOrigin();
  return withVendorAccess(request, async (weddingId) => {
    const id = vendorIdSchema.safeParse((await params).vendorId);
    const data = id.success && await savedVendorListing(weddingId, id.data);
    return data ? authJson({ data }) : authError(404, "PLACE_UNAVAILABLE", "Vendor listing unavailable.");
  });
}
