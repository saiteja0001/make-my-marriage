import { saveDiscoveredVendor } from "@/modules/vendors/discovery";
import { savePlaceSchema } from "@/modules/vendors/discovery-validation";
import { authJson, readJson, validationError } from "@/server/auth/http";
import { withVendorAccess } from "../_request";

export function POST(request: Request) {
  return withVendorAccess(request, async (weddingId) => {
    const body = await readJson(request, "vendor");
    if (body.error) return body.error;
    const parsed = savePlaceSchema.safeParse(body.value);
    if (!parsed.success) return validationError(parsed.error);
    const { vendor, created } = await saveDiscoveredVendor(weddingId, parsed.data);
    return authJson({ data: vendor }, created ? 201 : 200);
  });
}
