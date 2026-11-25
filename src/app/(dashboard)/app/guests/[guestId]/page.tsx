import type { Metadata } from "next";
import Link from "next/link";
import { guestDraftContext } from "@/modules/guests/service";
import { rsvpStatuses } from "@/modules/guests/validation";
import { WorkspaceFormLink } from "../../_components/workspace-form-link";
import { requireWorkspaceGuest } from "../_workspace";
import { GuestEvents } from "../guest-events";
import { RsvpRefresh } from "../rsvp-refresh";
import { DeleteGuest } from "./delete-guest";
import { GuestInvitationDelivery } from "./invitation-delivery";
import styles from "../guests.module.css";

export const metadata: Metadata = { title: "Guest group details" };

export default async function GuestPage({ params, searchParams }: {
  params: Promise<{ guestId: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { membershipId, guest, wedding } = await requireWorkspaceGuest((await params).guestId);
  const { notice } = await searchParams;
  const edit = "/app/guests?" + new URLSearchParams({ form: guest.id, from: "details" });

  return (
    <>
      <Link href="/app/guests" className={styles.textAction}>Back to guest list</Link>
      {notice === "updated" && <p className={styles.notice} role="status">Guest group updated.</p>}
      <header className={styles.heading}>
        <div>
          <h1>{guest.name}</h1>
          <p className={styles.status} data-status={guest.rsvpStatus}>{rsvpStatuses[guest.rsvpStatus]}</p>
        </div>
        <div className={styles.rowActions}>
          <DeleteGuest id={guest.id} name={guest.name} revision={guest.revision} context={guestDraftContext(membershipId, wedding.id)} />
          <WorkspaceFormLink href={edit} className={styles.primary}>Edit guest group</WorkspaceFormLink>
        </div>
      </header>

      <RsvpRefresh />
      <div className={styles.shareLayout}>
        <GuestInvitationDelivery key={guest.id} guestId={guest.id} guestName={guest.name}
          rsvpLabel={rsvpStatuses[guest.rsvpStatus]} timeZone={wedding.timeZone} edit={edit} />
        <dl className={styles.details}>
          <div><dt>Party limit</dt><dd>{guest.maxGuests.toLocaleString("en-IN")} {guest.maxGuests === 1 ? "guest" : "guests"}, including the named guest</dd></div>
          {guest.email && <div><dt>Email</dt><dd>{guest.email}</dd></div>}
          {guest.phone && <div><dt>Phone</dt><dd>{guest.phone}</dd></div>}
          <div><dt>Selected events</dt><dd><GuestEvents guest={guest} timeZone={wedding.timeZone} /></dd></div>
          <div>
            <dt>RSVP status</dt>
            <dd>{rsvpStatuses[guest.rsvpStatus]}{guest.attendingCount !== null && ` · ${guest.attendingCount.toLocaleString("en-IN")} attending`}</dd>
          </div>
          {guest.notes && <div><dt>Organiser notes</dt><dd>{guest.notes}</dd></div>}
        </dl>
      </div>
    </>
  );
}
