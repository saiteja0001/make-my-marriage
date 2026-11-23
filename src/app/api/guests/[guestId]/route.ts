import { deleteGuest, getGuest, updateGuest } from "@/modules/guests/service";
import { guestIdSchema, updateGuestSchema } from "@/modules/guests/validation";
import { authError, authJson, readJson, validationError } from "@/server/auth/http";
import { guestNotFound, withGuestAccess } from "../_request";

type Context = { params: Promise<{ guestId: string }> };

function readRevision(request: Request) {
  const value = request.headers.get("if-match");
  if (value === null) return undefined;
  const revision = Number(/^"([0-9]+)"$/.exec(value)?.[1]);
  return Number.isSafeInteger(revision) ? revision : null;
}

export function GET(request: Request, { params }: Context) {
  return withGuestAccess(request, async (weddingId) => {
    const id = guestIdSchema.safeParse((await params).guestId);
    if (!id.success) return guestNotFound();
    const guest = await getGuest(weddingId, id.data);
    return guest ? authJson({ data: guest }) : guestNotFound();
  });
}

export function PATCH(request: Request, { params }: Context) {
  return withGuestAccess(request, async (weddingId) => {
    const id = guestIdSchema.safeParse((await params).guestId);
    if (!id.success) return guestNotFound();
    const revision = readRevision(request);
    if (revision === null) return authError(400, "VALIDATION_ERROR", "Use a valid guest revision.");
    const body = await readJson(request, "guest");
    if (body.error) return body.error;
    const parsed = updateGuestSchema.safeParse(body.value);
    if (!parsed.success) return validationError(parsed.error);
    const guest = await updateGuest(weddingId, id.data, parsed.data, revision);
    return guest ? authJson({ data: guest }) : guestNotFound();
  });
}

export function DELETE(request: Request, { params }: Context) {
  return withGuestAccess(request, async (weddingId) => {
    const id = guestIdSchema.safeParse((await params).guestId);
    if (!id.success) return guestNotFound();
    const revision = readRevision(request);
    if (revision === null) return authError(400, "VALIDATION_ERROR", "Use a valid guest revision.");
    return await deleteGuest(weddingId, id.data, revision) ? authJson({ success: true }) : guestNotFound();
  });
}
