import { TaskConflict, TaskCreationGone, taskDraftContext, TaskReferenceUnavailable } from "@/modules/tasks/service";
import { getWeddingForUser } from "@/modules/wedding/service";
import { authError, forbiddenOrigin, sameOrigin } from "@/server/auth/http";
import { getSignedInUser } from "@/server/auth/session";

export function taskNotFound() {
  return authError(404, "NOT_FOUND", "Task not found.");
}

export async function withTaskAccess(
  request: Request,
  handle: (scope: { weddingId: string; membershipId: string }) => Promise<Response>,
) {
  const mutation = request.method !== "GET" && request.method !== "HEAD";
  if (mutation && !sameOrigin(request)) return forbiddenOrigin();
  try {
    const user = await getSignedInUser();
    if (!user) return authError(401, "UNAUTHENTICATED", "Log in to continue.");
    const current = await getWeddingForUser(user.id);
    if (!current) return authError(404, "NOT_FOUND", "Wedding not found.");
    const { membershipId, wedding: { id: weddingId, timeZone } } = current;
    const draft = request.headers.get("x-task-draft");
    if (mutation && draft !== null && draft !== taskDraftContext(membershipId, weddingId, timeZone)) {
      return authError(409, "DRAFT_CHANGED", "Your account, wedding, or wedding timezone changed. Reopen the task before saving.");
    }
    return await handle({ weddingId, membershipId });
  } catch (error) {
    if (error instanceof TaskConflict) return authError(409, "CONFLICT", error.message);
    if (error instanceof TaskCreationGone) return authError(410, "TASK_DELETED", error.message);
    if (error instanceof TaskReferenceUnavailable) {
      return authError(404, "NOT_FOUND", error.message, { [error.field]: error.message });
    }
    console.error("Task operation failed", error instanceof Error ? error.name : "UnknownError");
    return authError(503, "INTERNAL_ERROR", "Tasks are temporarily unavailable. Please try again.");
  }
}
