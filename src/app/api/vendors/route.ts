import { z } from "zod";
import { createVendor, listVendors } from "@/modules/vendors/service";
import { createVendorSchema, vendorListSchema } from "@/modules/vendors/validation";
import { authError, authJson, readJson, validationError } from "@/server/auth/http";
import { withVendorAccess } from "./_request";

export function GET(request: Request) {
  return withVendorAccess(request, async (weddingId) => {
    const query = vendorListSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    return query.success ? authJson(await listVendors(weddingId, query.data)) : validationError(query.error);
  });
}

export function POST(request: Request) {
  return withVendorAccess(request, async (weddingId) => {
    const key = z.uuid().optional().safeParse(request.headers.get("idempotency-key") ?? undefined);
    if (!key.success) return authError(400, "VALIDATION_ERROR", "Use a valid vendor request key.");
    const body = await readJson(request, "vendor");
    if (body.error) return body.error;
    const values = createVendorSchema.safeParse(body.value);
    if (!values.success) return validationError(values.error);
    const { vendor, replayed } = await createVendor(weddingId, values.data, key.data);
    return authJson({ data: vendor }, replayed ? 200 : 201);
  });
}
