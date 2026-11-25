import { archiveVendor, getVendor, updateVendor } from "@/modules/vendors/service";
import { updateVendorSchema, vendorIdSchema } from "@/modules/vendors/validation";
import { authJson, readJson, validationError } from "@/server/auth/http";
import { vendorNotFound, vendorRevision, withVendorAccess } from "../_request";

type Params = { params: Promise<{ vendorId: string }> };

export function GET(request: Request, { params }: Params) {
  return withVendorAccess(request, async (weddingId) => {
    const id = vendorIdSchema.safeParse((await params).vendorId);
    const data = id.success && await getVendor(weddingId, id.data);
    return data ? authJson({ data }) : vendorNotFound();
  });
}

export function PATCH(request: Request, { params }: Params) {
  return withVendorAccess(request, async (weddingId) => {
    const id = vendorIdSchema.safeParse((await params).vendorId);
    if (!id.success) return vendorNotFound();
    const revision = vendorRevision(request);
    const body = await readJson(request, "vendor");
    if (body.error) return body.error;
    const changes = updateVendorSchema.safeParse(body.value);
    if (!changes.success) return validationError(changes.error);
    const data = await updateVendor(weddingId, id.data, changes.data, revision);
    return data ? authJson({ data }) : vendorNotFound();
  });
}

export function DELETE(request: Request, { params }: Params) {
  return withVendorAccess(request, async (weddingId) => {
    const id = vendorIdSchema.safeParse((await params).vendorId);
    const data = id.success && await archiveVendor(weddingId, id.data, vendorRevision(request));
    return data ? authJson({ data }) : vendorNotFound();
  });
}
