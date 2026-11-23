import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getEvent } from "@/modules/events/service";
import { eventIdSchema } from "@/modules/events/validation";
import { getWeddingForUser } from "@/modules/wedding/service";
import { getSignedInUser } from "@/server/auth/session";

export const requireEventWorkspace = cache(async () => {
  const user = await getSignedInUser();
  if (!user) redirect("/login");
  const current = await getWeddingForUser(user.id);
  if (!current) redirect("/onboarding");
  return { user, ...current };
});

export async function requireWorkspaceEvent(eventId: string) {
  const workspace = await requireEventWorkspace();
  if (!eventIdSchema.safeParse(eventId).success) notFound();
  const event = await getEvent(workspace.wedding.id, eventId);
  if (!event) notFound();
  return { ...workspace, event };
}
