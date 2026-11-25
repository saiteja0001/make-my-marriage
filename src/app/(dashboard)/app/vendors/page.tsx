import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listEvents } from "@/modules/events/service";
import { getVendor, vendorDraftContext } from "@/modules/vendors/service";
import { vendorIdSchema } from "@/modules/vendors/validation";
import { getWeddingForUser } from "@/modules/wedding/service";
import { getSignedInUser } from "@/server/auth/session";
import { WorkspaceDraftShell } from "../_components/workspace-draft";
import { VendorDirectory } from "./vendor-directory";

export const metadata: Metadata = { title: "My Vendors" };

export default async function VendorsPage({ searchParams }: { searchParams: Promise<{ vendor?: string }> }) {
  const user = await getSignedInUser();
  if (!user) redirect("/login");
  const current = await getWeddingForUser(user.id);
  if (!current) redirect("/onboarding");
  const { wedding, membership, membershipId } = current;
  const context = vendorDraftContext(wedding.id, membershipId);
  const selected = vendorIdSchema.safeParse((await searchParams).vendor);
  const [savedEvents, initialVendor] = await Promise.all([
    listEvents(wedding.id, { includeArchived: true }),
    selected.success ? getVendor(wedding.id, selected.data) : null,
  ]);
  const events = savedEvents
    .map(({ id, name, archivedAt }) => ({ id, name, archived: Boolean(archivedAt) }));
  return <WorkspaceDraftShell currentPath="/app/vendors" member={{ name: user.name, role: membership.role }}>
    <VendorDirectory key={context + (initialVendor?.id ?? "")} events={events} timeZone={wedding.timeZone}
      context={context} initialVendor={initialVendor ?? undefined} />
  </WorkspaceDraftShell>;
}
