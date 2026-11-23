import { z } from "zod";
import { createGuest, listGuests } from "@/modules/guests/service";
import { createGuestSchema, guestListSchema } from "@/modules/guests/validation";
import { authError, authJson, readJson, validationError } from "@/server/auth/http";
import { withGuestAccess } from "./_request";

export function GET(request: Request) {
  return withGuestAccess(request, async (weddingId) => {
    const parsed = guestListSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    return parsed.success ? authJson(await listGuests(weddingId, parsed.data)) : validationError(parsed.error);
  });
}

export function POST(request: Request) {
  return withGuestAccess(request, async (weddingId) => {
    const key = z.uuid().optional().safeParse(request.headers.get("idempotency-key") ?? undefined);
    if (!key.success) return authError(400, "VALIDATION_ERROR", "Use a valid guest request key.");
    const body = await readJson(request, "guest");
    if (body.error) return body.error;
    const parsed = createGuestSchema.safeParse(body.value);
    if (!parsed.success) return validationError(parsed.error);
    const { guest, replayed } = await createGuest(weddingId, parsed.data, key.data);
    return authJson({ data: guest }, replayed ? 200 : 201);
  });
}
