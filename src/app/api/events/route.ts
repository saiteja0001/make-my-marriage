import { z } from "zod";
import { createEvent, listEvents } from "@/modules/events/service";
import { createEventSchema, eventListSchema } from "@/modules/events/validation";
import { authError, authJson, readJson, validationError } from "@/server/auth/http";
import { withEventAccess } from "./_request";

export function GET(request: Request) {
  return withEventAccess(request, async (weddingId) => {
    const params = new URL(request.url).searchParams;
    const query = eventListSchema.safeParse({
      includeArchived: params.get("includeArchived") ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
    });
    if (!query.success) return validationError(query.error);
    return authJson({ data: await listEvents(weddingId, query.data) });
  });
}

export function POST(request: Request) {
  return withEventAccess(request, async (weddingId) => {
    const key = z.uuid().optional().safeParse(request.headers.get("idempotency-key") ?? undefined);
    if (!key.success) return authError(400, "VALIDATION_ERROR", "Use a valid event request key.");
    const body = await readJson(request, "event");
    if (body.error) return body.error;
    const input = createEventSchema.safeParse(body.value);
    if (!input.success) return validationError(input.error);

    const { event, replayed } = await createEvent(weddingId, input.data, key.data);
    return authJson({ data: event }, replayed ? 200 : 201);
  });
}
