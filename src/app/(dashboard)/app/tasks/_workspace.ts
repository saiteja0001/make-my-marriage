import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getTask } from "@/modules/tasks/service";
import { taskIdSchema } from "@/modules/tasks/validation";
import { getWeddingForUser } from "@/modules/wedding/service";
import { getSignedInUser } from "@/server/auth/session";

export const requireTaskWorkspace = cache(async () => {
  const user = await getSignedInUser();
  if (!user) redirect("/login");
  const current = await getWeddingForUser(user.id);
  if (!current) redirect("/onboarding");
  return { user, ...current };
});

export async function requireWorkspaceTask(taskId: string) {
  const scope = await requireTaskWorkspace();
  const id = taskIdSchema.safeParse(taskId);
  if (!id.success) notFound();
  const task = await getTask(scope.wedding.id, id.data);
  if (!task) notFound();
  return { ...scope, task };
}
