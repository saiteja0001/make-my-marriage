import { deleteTask, getTask, updateTask } from "@/modules/tasks/service";
import { taskIdSchema, updateTaskSchema } from "@/modules/tasks/validation";
import { authError, authJson, readJson, validationError } from "@/server/auth/http";
import { taskNotFound, withTaskAccess } from "../_request";

type Context = { params: Promise<{ taskId: string }> };

function readRevision(request: Request) {
  const value = request.headers.get("if-match");
  if (value === null) return undefined;
  const revision = Number(/^"([0-9]+)"$/.exec(value)?.[1]);
  return Number.isSafeInteger(revision) ? revision : null;
}

export function GET(request: Request, { params }: Context) {
  return withTaskAccess(request, async ({ weddingId }) => {
    const id = taskIdSchema.safeParse((await params).taskId);
    if (!id.success) return taskNotFound();
    const task = await getTask(weddingId, id.data);
    return task ? authJson({ data: task }) : taskNotFound();
  });
}

export function PATCH(request: Request, { params }: Context) {
  return withTaskAccess(request, async ({ weddingId }) => {
    const id = taskIdSchema.safeParse((await params).taskId);
    if (!id.success) return taskNotFound();
    const revision = readRevision(request);
    if (revision === null) return authError(400, "VALIDATION_ERROR", "Use a valid task revision.");
    const body = await readJson(request, "task");
    if (body.error) return body.error;
    const parsed = updateTaskSchema.safeParse(body.value);
    if (!parsed.success) return validationError(parsed.error);
    const task = await updateTask(weddingId, id.data, parsed.data, revision);
    return task ? authJson({ data: task }) : taskNotFound();
  });
}

export function DELETE(request: Request, { params }: Context) {
  return withTaskAccess(request, async ({ weddingId }) => {
    const id = taskIdSchema.safeParse((await params).taskId);
    if (!id.success) return taskNotFound();
    const revision = readRevision(request);
    if (revision === null) return authError(400, "VALIDATION_ERROR", "Use a valid task revision.");
    return await deleteTask(weddingId, id.data, revision) ? authJson({ success: true }) : taskNotFound();
  });
}
