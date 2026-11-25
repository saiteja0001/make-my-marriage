import { withVendorAccess } from "@/app/api/vendors/_request";
import { discoverVendors } from "@/modules/vendors/discovery";
import { discoverySearchSchema } from "@/modules/vendors/discovery-validation";
import { authJson, forbiddenOrigin, validationError } from "@/server/auth/http";

export function GET(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return forbiddenOrigin();
  return withVendorAccess(request, async (weddingId, weddingLocation) => {
    const query = discoverySearchSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) return validationError(query.error);
    const location = query.data.location ?? weddingLocation;
    return authJson({ data: await discoverVendors(weddingId, query.data.category, location) });
  });
}
