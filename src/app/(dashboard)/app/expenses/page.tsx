import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listEvents } from "@/modules/events/service";
import { expenseDraftContext } from "@/modules/expenses/service";
import { vendorOptions } from "@/modules/vendors/service";
import { getWeddingForUser } from "@/modules/wedding/service";
import { weddingLocalDate } from "@/modules/wedding/wedding-date";
import { getSignedInUser } from "@/server/auth/session";
import { WorkspaceDraftShell } from "../_components/workspace-draft";
import { ExpenseLedger } from "./expense-ledger";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const user = await getSignedInUser();
  if (!user) redirect("/login");
  const current = await getWeddingForUser(user.id);
  if (!current) redirect("/onboarding");
  const { wedding, membership, membershipId } = current;
  const context = expenseDraftContext(wedding.id, membershipId);
  const [savedEvents, vendors] = await Promise.all([
    listEvents(wedding.id, { includeArchived: true }),
    vendorOptions(wedding.id),
  ]);
  const events = savedEvents
    .map(({ id, name, archivedAt }) => ({ id, name, archived: Boolean(archivedAt) }));
  return <WorkspaceDraftShell currentPath="/app/expenses" member={{ name: user.name, role: membership.role }}>
    <ExpenseLedger key={context} events={events} vendors={vendors} context={context}
      today={weddingLocalDate(new Date(), wedding.timeZone)} />
  </WorkspaceDraftShell>;
}
