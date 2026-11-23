import { archiveEvent, getEvent, updateEvent } from "@/modules/events/service";
import { eventIdSchema, updateEventSchema } from "@/modules/events/validation";
import { authError, authJson, readJson, validationError } from "@/server/auth/http";
import { eventNotFound, withEventAccess } from "../_request";

type Context = { params: Promise<{ eventId: string }> };

export function GET(request: Request, { params }: Context) {
  return withEventAccess(request, async (weddingId) => {
    const { eventId } = await params;
    if (!eventIdSchema.safeParse(eventId).success) return eventNotFound();
    const event = await getEvent(weddingId, eventId);
    return event ? authJson({ data: event }) : eventNotFound();
  });
}

export function PATCH(request: Request, { params }: Context) {
  return withEventAccess(request, async (weddingId) => {
    const { eventId } = await params;
    if (!eventIdSchema.safeParse(eventId).success) return eventNotFound();

    const match = request.headers.get("if-match");
    const revision = match === null ? undefined : Number(/^"([0-9]+)"$/.exec(match)?.[1]);
    if (revision !== undefined && !Number.isSafeInteger(revision)) {
      return authError(400, "VALIDATION_ERROR", "Use a valid event revision.");
    }
    const body = await readJson(request, "event");
    if (body.error) return body.error;
    const input = updateEventSchema.safeParse(body.value);
    if (!input.success) return validationError(input.error);

    const event = await updateEvent(weddingId, eventId, input.data, revision);
    return event ? authJson({ data: event }) : eventNotFound();
  });
}

export function DELETE(request: Request, { params }: Context) {
  return withEventAccess(request, async (weddingId) => {
    const { eventId } = await params;
    if (!eventIdSchema.safeParse(eventId).success) return eventNotFound();
    return await archiveEvent(weddingId, eventId) ? authJson({ success: true }) : eventNotFound();
  });
}
