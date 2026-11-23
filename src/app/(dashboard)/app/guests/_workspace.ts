import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getGuest } from "@/modules/guests/service";
import { guestIdSchema } from "@/modules/guests/validation";
import { getWeddingForUser } from "@/modules/wedding/service";
import { getSignedInUser } from "@/server/auth/session";

export const requireGuestWorkspace = cache(async () => {
  const user = await getSignedInUser();
  if (!user) redirect("/login");
  const current = await getWeddingForUser(user.id);
  if (!current) redirect("/onboarding");
  return { user, ...current };
});

export async function requireWorkspaceGuest(guestId: string) {
  const scope = await requireGuestWorkspace();
  const id = guestIdSchema.safeParse(guestId);
  if (!id.success) notFound();
  const guest = await getGuest(scope.wedding.id, id.data);
  if (!guest) notFound();
  return { ...scope, guest };
}
