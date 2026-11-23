"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { memberRoleLabels, type MemberRole } from "@/modules/wedding/member-roles";
import type { listPendingInvitations, listWeddingMembers } from "@/modules/wedding/member-service";
import styles from "./wedding-members.module.css";

type Members = Awaited<ReturnType<typeof listWeddingMembers>>;
type Invitations = Awaited<ReturnType<typeof listPendingInvitations>>;
type ActionError = { message: string; details?: Record<string, string> };
type MemberAction = { member: Members[number]; role: MemberRole; removing: boolean };

const countLabel = (count: number, noun: string) => count + " " + noun + (count === 1 ? "" : "s");

export function WeddingMembers({ weddingName, timeZone, userId, isAdmin, members, invitations }: {
  weddingName: string;
  timeZone: string;
  userId: string;
  isAdmin: boolean;
  members: Members;
  invitations: Invitations;
}) {
  const router = useRouter();
  const inviteDialog = useRef<HTMLDialogElement>(null);
  const revokeDialog = useRef<HTMLDialogElement>(null);
  const memberDialog = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("MANAGER");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemberRole | "ALL">("ALL");
  const [selected, setSelected] = useState<Invitations[number] | null>(null);
  const [memberAction, setMemberAction] = useState<MemberAction | null>(null);
  const [error, setError] = useState<ActionError | null>(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, refresh] = useTransition();
  const busy = saving || refreshing;
  const admins = members.filter((member) => member.role === "ADMIN").length;
  const filtered = members.filter((member) =>
    (filter === "ALL" || member.role === filter) &&
    (member.user.name + " " + member.user.email).toLowerCase().includes(query.trim().toLowerCase()),
  );
  const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/members/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? { message: "We couldn’t send the invitation. Please try again." });
        return;
      }
      setNotice("Invitation sent to " + body.data.email + ".");
      inviteDialog.current?.close();
      setEmail("");
      setRole("MANAGER");
      refresh(() => router.refresh());
    } catch {
      setError({ message: "We couldn’t connect. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function revoke() {
    if (!selected || busy) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/members/invitations/" + selected.id, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? { message: "We couldn’t revoke the invitation. Please try again." });
        return;
      }
      setNotice("Invitation revoked.");
      revokeDialog.current?.close();
      refresh(() => router.refresh());
    } catch {
      setError({ message: "We couldn’t connect. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberAction || busy) return;
    const { member, role, removing } = memberAction;
    if (!removing && role === member.role) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/members/" + member.membershipId, removing ? { method: "DELETE" } : {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? { message: "We couldn’t update this member. Please try again." });
        return;
      }
      setNotice(removing ? member.user.name + " was removed." : member.user.name + " is now a wedding " + memberRoleLabels[role] + ".");
      memberDialog.current?.close();
      refresh(() => router.refresh());
    } catch {
      setError({ message: "We couldn’t connect. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.shell}>
      <Link href="/app" className={styles.back}><span aria-hidden="true">←</span> Back to wedding overview</Link>
      <div className={styles.hero}>
        <p className={styles.weddingName}>{weddingName}</p>
        <h1>Wedding members</h1>
        <p className={styles.subtitle}>Plan your wedding together with family and collaborators.</p>
        <div className={styles.heroActions}>
          {isAdmin && <button type="button" className={styles.primary} disabled={busy} onClick={() => {
            setError(null);
            inviteDialog.current?.showModal();
          }}>Invite member</button>}
          <p className={styles.counts}>
            {countLabel(admins, "Admin")} · {countLabel(members.length - admins, "Manager")}
            {isAdmin && " · " + invitations.length + " pending"}
          </p>
        </div>
      </div>

      {notice && <p className={styles.notice} role="status">{notice}</p>}
      <div className={styles.columns} data-admin={isAdmin}>
        <section className={styles.card} aria-labelledby="active-members-heading">
          <h2 id="active-members-heading">Active members</h2>
          <div className={styles.filters}>
            <label className={styles.search}>
              <span className="sr-only">Search members</span>
              <input type="search" className={styles.control} placeholder="Filter by name or email" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label>
              <span className="sr-only">Filter by role</span>
              <select className={styles.control} value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
                <option value="ALL">All roles</option>
                <option value="ADMIN">Admins</option>
                <option value="MANAGER">Managers</option>
              </select>
            </label>
          </div>
          {filtered.length ? <ul className={styles.members}>
            {filtered.map((member) => (
              <li className={styles.member} key={member.membershipId}>
                <span className={styles.initials} aria-hidden="true">
                  {member.user.name.split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join("").toUpperCase()}
                </span>
                <div className={styles.identity}>
                  <strong>{member.user.name}</strong>
                  {member.user.id === userId && <span className={styles.you}>You</span>}
                  <p>{member.user.email}</p>
                </div>
                <div className={styles.memberControls}>
                  <span className={styles.role} data-role={member.role}>{memberRoleLabels[member.role]}</span>
                  {isAdmin && (member.role === "ADMIN" && admins === 1 ? (
                    <span className={styles.lastAdmin}>Last Admin</span>
                  ) : (
                    <button type="button" className={styles.manage} disabled={busy} aria-label={"Manage " + member.user.name} onClick={() => {
                      setMemberAction({ member, role: member.role, removing: false });
                      setError(null);
                      requestAnimationFrame(() => memberDialog.current?.showModal());
                    }}>Manage</button>
                  ))}
                </div>
              </li>
            ))}
          </ul> : <p className={styles.empty}>No members match your filters.</p>}
        </section>

        {isAdmin && <section className={styles.card} aria-labelledby="pending-invitations-heading">
          <h2 id="pending-invitations-heading">Pending invitations</h2>
          {invitations.length ? <ul className={styles.invitations}>
            {invitations.map((invitation) => (
              <li className={styles.invitation} key={invitation.id}>
                <div className={styles.inviteRow}>
                  <strong>{invitation.email}</strong>
                  <button type="button" className={styles.revoke} disabled={busy} aria-label={"Revoke invitation for " + invitation.email} onClick={() => {
                    setSelected(invitation);
                    setError(null);
                    revokeDialog.current?.showModal();
                  }}>Revoke</button>
                </div>
                <span className={styles.role} data-role={invitation.role}>{memberRoleLabels[invitation.role]}</span>
                <p>
                  Sent <time dateTime={invitation.createdAt}>{date.format(new Date(invitation.createdAt))}</time>
                  {" · Expires "}<time dateTime={invitation.expiresAt}>{date.format(new Date(invitation.expiresAt))}</time>
                </p>
              </li>
            ))}
          </ul> : <p className={styles.empty}>No pending invitations.</p>}
        </section>}
      </div>

      {isAdmin && <>
        <dialog className={styles.dialog} ref={inviteDialog} aria-labelledby="invite-heading" onCancel={(event) => {
          if (saving) event.preventDefault();
        }}>
          <h2 id="invite-heading">Invite a wedding member</h2>
          <form onSubmit={submit} noValidate>
            <fieldset disabled={saving} className={styles.inviteForm}>
              <legend className="sr-only">Invitation details</legend>
              <label htmlFor="member-email">Email address</label>
              <input id="member-email" className={styles.control} type="email" maxLength={254} required value={email}
                onChange={(event) => { setEmail(event.target.value); setError(null); }}
                aria-invalid={Boolean(error?.details?.email)} aria-describedby={error?.details?.email ? "member-email-error" : undefined} />
              {error?.details?.email && <p className={styles.error} id="member-email-error">{error.details.email}</p>}
              <label htmlFor="member-role">Role</label>
              <select id="member-role" className={styles.control} value={role} onChange={(event) => setRole(event.target.value as MemberRole)}>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Admin</option>
              </select>
              <p className={styles.muted}>Admins can invite members and revoke pending invitations.</p>
            </fieldset>
            {error && !error.details?.email && <p className={styles.error} role="alert">{error.message}</p>}
            <div className={styles.dialogActions}>
              <button type="button" className={styles.secondary} disabled={saving} onClick={() => inviteDialog.current?.close()}>Cancel</button>
              <button type="submit" className={styles.primary} disabled={saving}>{saving ? "Sending…" : "Send invitation"}</button>
            </div>
          </form>
        </dialog>

        <dialog className={styles.dialog} ref={revokeDialog} aria-labelledby="revoke-heading" onCancel={(event) => {
          if (saving) event.preventDefault();
        }}>
          <h2 id="revoke-heading">Revoke this invitation?</h2>
          <p className={styles.muted}>{selected?.email} will need a new invitation to join.</p>
          {error && <p className={styles.error} role="alert">{error.message}</p>}
          <div className={styles.dialogActions}>
            <button type="button" className={styles.secondary} disabled={saving} onClick={() => revokeDialog.current?.close()}>Cancel</button>
            <button type="button" className={styles.primary} disabled={saving} onClick={revoke}>{saving ? "Revoking…" : "Revoke invitation"}</button>
          </div>
        </dialog>

        <dialog className={styles.dialog} ref={memberDialog} aria-labelledby="manage-member-heading" onCancel={(event) => {
          if (saving) event.preventDefault();
        }}>
          {memberAction && <>
            <h2 id="manage-member-heading">{memberAction.removing ? "Remove wedding member?" : "Manage wedding member"}</h2>
            <p className={styles.muted}><strong>{memberAction.member.user.name}</strong> · {memberAction.member.user.email}</p>
            <form onSubmit={saveMember}>
              {memberAction.removing ? (
                <p className={styles.muted}>
                  {memberAction.member.user.id === userId ? "You’ll lose access to this wedding." : "This member will lose access to the wedding immediately."}
                </p>
              ) : (
                <fieldset className={styles.inviteForm} disabled={saving}>
                  <legend className="sr-only">Member role</legend>
                  <label htmlFor="edit-member-role">Role</label>
                  <select id="edit-member-role" className={styles.control} value={memberAction.role} onChange={(event) => {
                    setMemberAction({ ...memberAction, role: event.target.value as MemberRole });
                    setError(null);
                  }}>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </fieldset>
              )}
              {error && <p className={styles.error} role="alert">{error.message}</p>}
              <div className={styles.dialogActions}>
                {memberAction.removing ? (
                  <button type="button" className={styles.secondary} disabled={saving} onClick={() => {
                    setMemberAction({ ...memberAction, removing: false });
                    setError(null);
                  }}>Keep member</button>
                ) : (
                  <>
                    <button type="button" className={styles.revoke} disabled={saving} onClick={() => {
                      setMemberAction({ ...memberAction, removing: true });
                      setError(null);
                    }}>Remove</button>
                    <button type="button" className={styles.secondary} disabled={saving} onClick={() => memberDialog.current?.close()}>Cancel</button>
                  </>
                )}
                <button type="submit" className={memberAction.removing ? styles.danger : styles.primary}
                  disabled={saving || (!memberAction.removing && memberAction.role === memberAction.member.role)}>
                  {memberAction.removing ? (saving ? "Removing…" : "Remove member") : (saving ? "Saving…" : "Save role")}
                </button>
              </div>
            </form>
          </>}
        </dialog>
      </>}
    </main>
  );
}
