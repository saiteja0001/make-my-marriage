import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { normalizeEmail } from "@/modules/auth/validation";
import { MemberError } from "@/modules/wedding/member-errors";
import { memberRoleLabels } from "@/modules/wedding/member-roles";
import { getPublicMemberInvitation } from "@/modules/wedding/member-service";
import { hasWeddingMembership } from "@/modules/wedding/service";
import { formatWeddingDate } from "@/modules/wedding/wedding-date";
import { getSignedInUser } from "@/server/auth/session";
import { InvitationActions } from "./invitation-actions";
import styles from "./invitation.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Wedding member invitation", robots: { index: false, follow: false } };

export default async function MemberInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getPublicMemberInvitation(token).then(
    (invitation) => ({ invitation, error: null }),
    (error: unknown) => {
      if (error instanceof MemberError) return { invitation: null, error };
      console.error("Member invitation lookup failed", error instanceof Error ? error.name : "UnknownError");
      return { invitation: null, error: null };
    },
  );

  const brand = <Link href="/" className={styles.brand}>Make My Marriage<span aria-hidden="true">.</span></Link>;
  if (!result.invitation) {
    const accepted = result.error?.code === "INVITATION_ALREADY_ACCEPTED";
    return (
      <main className={styles.shell}>
        {brand}
        <section className={styles.unavailable}>
          <h1>{accepted ? "Invitation already accepted" : "Invitation unavailable"}</h1>
          <p>{result.error?.message ?? "We couldn’t load this invitation. Please try again."}</p>
          <Link className={styles.primary} href={accepted ? "/app" : "/"}>{accepted ? "Open workspace" : "Back to homepage"}</Link>
        </section>
      </main>
    );
  }

  const { invitation } = result;
  const user = await getSignedInUser();
  const matches = user && normalizeEmail(user.email) === normalizeEmail(invitation.email);
  const alreadyJoined = matches && await hasWeddingMembership(user.id);
  const wedding = invitation.wedding;
  const name = wedding.title || `${wedding.brideName} & ${wedding.groomName}’s wedding`;

  return (
    <main className={styles.shell}>
      {brand}
      <div className={styles.layout}>
        <section className={styles.story} aria-labelledby="invitation-title">
          <div className={styles.photo}>
            <Image src="/wedding-hero.jpg" alt="" fill sizes="(max-width: 52rem) 92vw, 56vw" className={styles.image} />
          </div>
          <div className={styles.details}>
            <p className={styles.eyebrow}>Wedding member invitation</p>
            <h1 id="invitation-title">You’re invited to help plan the wedding</h1>
            <strong>{name}</strong>
            <p><time dateTime={wedding.weddingDate}>{formatWeddingDate(wedding.weddingDate)}</time></p>
            <div className={styles.roleNote}>
              <strong>Invited as {memberRoleLabels[invitation.role]}</strong>
              <p>Join the private workspace to plan together.</p>
            </div>
          </div>
        </section>
        <InvitationActions
          token={token}
          email={invitation.email}
          signedInEmail={user?.email}
          state={!user ? "guest" : !matches ? "mismatch" : alreadyJoined ? "member" : "ready"}
        />
      </div>
    </main>
  );
}
