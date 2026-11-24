import { notFound } from "next/navigation";
import { getPublicInvitation } from "@/modules/guests/invitations";
import { GuestInvitation } from "./guest-invitation";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getPublicInvitation(token);
  if (!invitation) notFound();
  return <GuestInvitation key={token} initial={invitation} token={token} />;
}
