import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listEvents } from "@/modules/events/service";
import { vendorDraftContext } from "@/modules/vendors/service";
import { getWeddingForUser } from "@/modules/wedding/service";
import { getSignedInUser } from "@/server/auth/session";
import { WorkspaceDraftShell } from "../_components/workspace-draft";
import { VendorDirectory } from "./vendor-directory";

export const metadata: Metadata = { title: "My Vendors" };

export default async function VendorsPage() {
  const user = await getSignedInUser();
  if (!user) redirect("/login");
  const current = await getWeddingForUser(user.id);
  if (!current) redirect("/onboarding");
  const { wedding, membership, membershipId } = current;
  const context = vendorDraftContext(wedding.id, membershipId);
  const events = (await listEvents(wedding.id, { includeArchived: true }))
    .map(({ id, name, archivedAt }) => ({ id, name, archived: Boolean(archivedAt) }));
  return <WorkspaceDraftShell currentPath="/app/vendors" member={{ name: user.name, role: membership.role }}>
    <VendorDirectory key={context} events={events} timeZone={wedding.timeZone} context={context} />
  </WorkspaceDraftShell>;
}
