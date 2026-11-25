"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { GuestInvitationPreview } from "@/modules/guests/delivery";
import { WorkspaceFormLink } from "../../_components/workspace-form-link";
import styles from "../guests.module.css";

const sendFallback = "We couldn’t send the invitation email. Please try again.";
const sessionExpired = "Your session expired. Sign in, then return here to try again.";
type RequestError = { message: string; status: number };

export function GuestInvitationDelivery({ guestId, guestName, rsvpLabel, timeZone, edit }: {
  guestId: string;
  guestName: string;
  rsvpLabel: string;
  timeZone: string;
  edit: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cardLink = useRef<HTMLInputElement>(null);
  const panelLink = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<GuestInvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<RequestError>();
  const [attempt, setAttempt] = useState(0);
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [confirmResend, setConfirmResend] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<RequestError>();

  useEffect(() => {
    const request = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/guests/${guestId}/invitation-link`, { signal: request.signal, cache: "no-store" });
        const result = await response.json().catch(() => null);
        if (request.signal.aborted) return;
        if (response.ok && typeof result?.data?.url === "string") setPreview(result.data);
        else setLoadError({ message: result?.error?.message || "The invitation link is temporarily unavailable.", status: response.status });
      } catch {
        if (!request.signal.aborted) setLoadError({ message: "We couldn’t load the invitation link. Try again.", status: 0 });
      } finally {
        if (!request.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => request.abort();
  }, [attempt, guestId]);

  function reload() {
    setLoading(true);
    setPreview(null);
    setLoadError(undefined);
    setSendError(undefined);
    setConfirmResend(false);
    setSent(false);
    setCopyFeedback("");
    setAttempt((previous) => previous + 1);
  }

  async function copyLink(field: HTMLInputElement | null) {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(preview.url);
      setCopyFeedback("Invitation link copied");
    } catch {
      field?.focus();
      field?.select();
      setCopyFeedback("Link selected. Copy it from the field above.");
    }
  }

  async function sendEmail() {
    if (!preview?.email || sending || sendError?.status === 409) return;
    setSending(true);
    setSent(false);
    setConfirmResend(false);
    setSendError(undefined);
    try {
      const response = await fetch(`/api/guests/${guestId}/send-invitation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewVersion: preview.previewVersion, invitationSentAt: preview.invitationSentAt }),
      });
      const result = await response.json().catch(() => null);
      const invitationSentAt = result?.data?.invitationSentAt;
      if (response.ok && typeof invitationSentAt === "string") {
        setPreview({ ...preview, invitationSentAt });
        setSent(true);
      } else {
        setSendError({ message: result?.error?.message || sendFallback, status: response.status });
      }
    } catch {
      setSendError({ message: sendFallback, status: 0 });
    } finally {
      setSending(false);
    }
  }

  const lastSent = preview?.invitationSentAt
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone })
      .format(new Date(preview.invitationSentAt))
    : null;
  const signInLink = <Link href="/login" target="_blank" rel="noopener" className={styles.secondary}>Open sign-in in a new tab</Link>;
  const linkStatus = loading ? <p role="status">Loading invitation link…</p> : loadError && (
    <div className={styles.invitationFeedback}>
      <p role="alert" className={styles.error}>{loadError.status === 401 ? sessionExpired : loadError.message}</p>
      <div className={styles.rowActions}>
        {loadError.status === 401 && signInLink}
        <button type="button" className={styles.secondary} onClick={reload}>Try again</button>
      </div>
    </div>
  );

  return (
    <section className={styles.shareCard} aria-labelledby="guest-invitation-title">
      <h2 id="guest-invitation-title">Invitation link</h2>
      <p>Share this private link with {guestName} so they can view their invitation and RSVP.</p>
      {linkStatus}
      {preview && <>
        <label className={styles.field}>
          <span>Guest invitation URL</span>
          <input ref={cardLink} value={preview.url} readOnly className={styles.control} onFocus={(event) => event.currentTarget.select()} />
        </label>
        <div className={styles.rowActions}>
          <button type="button" className={styles.primary} onClick={() => {
            setChannel("email");
            setCopyFeedback("");
            dialog.current?.showModal();
          }}>Send invitation</button>
          <button type="button" className={styles.secondary} onClick={() => void copyLink(cardLink.current)}>Copy link</button>
          <a href={preview.url} target="_blank" rel="noopener noreferrer" className={styles.textAction}>Open invitation</a>
        </div>
        {copyFeedback && <p role="status" className={styles.linkFeedback}>{copyFeedback}</p>}
        {lastSent && <p className={styles.linkFeedback}>Last emailed <time dateTime={preview.invitationSentAt ?? undefined}>{lastSent}</time></p>}
      </>}

      <dialog ref={dialog} className={`${styles.drawer} ${styles.invitationDrawer}`} aria-labelledby="send-invitation-title"
        onCancel={(event) => { if (sending) event.preventDefault(); }}
        onClose={() => { setCopyFeedback(""); setConfirmResend(false); }}>
        <header className={styles.invitationHeading}>
          <div>
            <h2 id="send-invitation-title">Send invitation</h2>
            <p>{guestName}</p>
            <p className={styles.invitationRsvp}>RSVP <strong>{rsvpLabel}</strong></p>
          </div>
          <button type="button" className={styles.secondary} disabled={sending} onClick={() => dialog.current?.close()}>Close</button>
        </header>

        <div className={styles.invitationBody}>
          <div className={styles.invitationChannels} role="group" aria-label="Invitation channel">
            <button type="button" aria-pressed={channel === "email"} disabled={sending} onClick={() => setChannel("email")}>Email</button>
            <button type="button" aria-pressed={channel === "whatsapp"} disabled={sending} onClick={() => {
              setChannel("whatsapp");
              setConfirmResend(false);
            }}>WhatsApp</button>
          </div>

          {linkStatus}
          {preview && (channel === "email" ? (
            <>
              {lastSent && <p className={styles.invitationSent} role={sent ? "status" : undefined}>
                <strong>Email sent</strong>
                <time dateTime={preview.invitationSentAt ?? undefined}>{lastSent}</time>
              </p>}
              {preview.email
                ? <dl className={styles.invitationMetadata}>
                    <div><dt>To</dt><dd>{preview.email}</dd></div>
                    <div><dt>Subject</dt><dd>{preview.subject}</dd></div>
                  </dl>
                : <div className={styles.invitationFeedback}>
                    <p>Add an email address to send this invitation by email.</p>
                    <WorkspaceFormLink href={edit} className={styles.secondary}>Edit guest group</WorkspaceFormLink>
                  </div>}
              <div className={styles.invitationPreview}>
                <h3>Email preview</h3>
                <p>{preview.message}</p>
                <a href={preview.url} target="_blank" rel="noopener noreferrer">View invitation &amp; RSVP</a>
              </div>
            </>
          ) : (
            <>
              <dl className={styles.invitationMetadata}>
                <div><dt>To</dt><dd>{preview.hasWhatsappNumber ? preview.phone : "Choose a contact in WhatsApp"}</dd></div>
              </dl>
              <div className={styles.invitationPreview}>
                <h3>Message preview</h3>
                <p>{preview.whatsappMessage}</p>
              </div>
              <p>You’ll review and send the message in WhatsApp.</p>
            </>
          ))}
          {preview && <label className={styles.field}>
            <span>Private RSVP link</span>
            <input ref={panelLink} value={preview.url} readOnly className={styles.control} onFocus={(event) => event.currentTarget.select()} />
          </label>}
        </div>

        {preview && <footer className={styles.invitationFooter}>
          {copyFeedback && <p role="status" className={styles.linkFeedback}>{copyFeedback}</p>}
          {channel === "email" && sendError && <p role="alert" className={styles.error}>
            {sendError.status === 401 ? sessionExpired : sendError.message}
          </p>}
          {channel === "email" && confirmResend && <p className={styles.invitationFeedback} role="status">
            Send another copy of this invitation to <strong>{preview.email}</strong>?
          </p>}
          <div className={styles.invitationActions}>
            <button type="button" className={styles.secondary} onClick={() => void copyLink(panelLink.current)}>Copy invitation link</button>
            {channel === "whatsapp" ? (
              <a href={preview.whatsappUrl} className={styles.primary} target="_blank" rel="noopener noreferrer">Open WhatsApp</a>
            ) : sendError?.status === 409 ? (
              <button type="button" className={styles.primary} onClick={reload}>Reload preview</button>
            ) : preview.email && (
              <>
                {sendError?.status === 401 && signInLink}
                {confirmResend && <button type="button" className={styles.secondary} onClick={() => setConfirmResend(false)}>Cancel resend</button>}
                <button type="button" className={styles.primary} disabled={sending} onClick={() => {
                  if (lastSent && !confirmResend && !sendError) setConfirmResend(true);
                  else void sendEmail();
                }}>
                  {sending ? "Sending…" : sendError ? "Try again" : confirmResend ? "Confirm resend" : lastSent ? "Resend email" : "Send email"}
                </button>
              </>
            )}
          </div>
        </footer>}
      </dialog>
    </section>
  );
}
