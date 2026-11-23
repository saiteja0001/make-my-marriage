import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listPendingInvitations, listWeddingMembers } from "@/modules/wedding/member-service";
import { getWeddingForUser } from "@/modules/wedding/service";
import { getSignedInUser } from "@/server/auth/session";
import { WorkspaceHeader } from "../../_components/workspace-header";
import { WeddingMembers } from "./wedding-members";

export const metadata: Metadata = { title: "Wedding members" };

export default async function WeddingMembersPage() {
  const user = await getSignedInUser();
  if (!user) redirect("/login");
  const current = await getWeddingForUser(user.id);
  if (!current) redirect("/onboarding");

  const { wedding, membership } = current;
  const isAdmin = membership.role === "ADMIN";
  const [members, invitations] = await Promise.all([
    listWeddingMembers(user.id),
    isAdmin ? listPendingInvitations(user.id) : Promise.resolve([]),
  ]);
  return (
    <>
      <WorkspaceHeader member={{ name: user.name, role: membership.role }} />
      <WeddingMembers
        key={wedding.id}
        weddingName={wedding.title || `${wedding.brideName} & ${wedding.groomName}`}
        timeZone={wedding.timeZone}
        userId={user.id}
        isAdmin={isAdmin}
        members={members}
        invitations={invitations}
      />
    </>
  );
}
