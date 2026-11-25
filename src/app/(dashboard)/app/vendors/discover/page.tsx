import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { discoveryMode } from "@/modules/vendors/discovery";
import { vendorDraftContext } from "@/modules/vendors/service";
import { getWeddingForUser } from "@/modules/wedding/service";
import { getSignedInUser } from "@/server/auth/session";
import { WorkspaceDraftShell } from "../../_components/workspace-draft";
import { DiscoverVendors } from "./discover-vendors";

export const metadata: Metadata = { title: "Discover Vendors" };

export default async function DiscoverVendorsPage() {
  const user = await getSignedInUser();
  if (!user) redirect("/login");
  const current = await getWeddingForUser(user.id);
  if (!current) redirect("/onboarding");
  const { membership, wedding, membershipId } = current;
  const context = vendorDraftContext(wedding.id, membershipId);
  return <WorkspaceDraftShell currentPath="/app/vendors/discover" member={{ name: user.name, role: membership.role }}>
    <DiscoverVendors key={context} location={wedding.location.formattedAddress} mode={discoveryMode()} context={context} />
  </WorkspaceDraftShell>;
}
