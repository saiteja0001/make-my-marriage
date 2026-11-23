import { z } from "zod";
import { createTask, listTasks } from "@/modules/tasks/service";
import { createTaskSchema, taskListSchema } from "@/modules/tasks/validation";
import { authError, authJson, readJson, validationError } from "@/server/auth/http";
import { withTaskAccess } from "./_request";

export function GET(request: Request) {
  return withTaskAccess(request, async ({ weddingId, membershipId }) => {
    const parsed = taskListSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    return parsed.success ? authJson(await listTasks(weddingId, membershipId, parsed.data)) : validationError(parsed.error);
  });
}

export function POST(request: Request) {
  return withTaskAccess(request, async ({ weddingId }) => {
    const key = z.uuid().optional().safeParse(request.headers.get("idempotency-key") ?? undefined);
    if (!key.success) return authError(400, "VALIDATION_ERROR", "Use a valid task request key.");
    const body = await readJson(request, "task");
    if (body.error) return body.error;
    const parsed = createTaskSchema.safeParse(body.value);
    if (!parsed.success) return validationError(parsed.error);
    const { task, replayed } = await createTask(weddingId, parsed.data, key.data);
    return authJson({ data: task }, replayed ? 200 : 201);
  });
}
