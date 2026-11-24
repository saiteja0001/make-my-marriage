"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../guests.module.css";

export function GuestInvitationLink({ guestId, guestName }: { guestId: string; guestName: string }) {
  const [url, setUrl] = useState("");
  const [waiting, setWaiting] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const request = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/guests/${guestId}/invitation-link`, { signal: request.signal, cache: "no-store" });
        const result = await response.json().catch(() => null);
        if (request.signal.aborted) return;
        if (response.ok && typeof result?.data?.url === "string") setUrl(result.data.url);
        else setError(result?.error?.message || "The invitation link is temporarily unavailable.");
      } catch {
        if (!request.signal.aborted) setError("We couldn’t load the invitation link. Try again.");
      } finally {
        if (!request.signal.aborted) setWaiting(false);
      }
    }
    void load();
    return () => request.abort();
  }, [attempt, guestId]);

  async function copyLink() {
    setCopied(false);
    setError("");
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      input.current?.focus();
      input.current?.select();
      setError("Link selected. Copy it from the field above.");
    }
  }

  return (
    <section className={styles.shareCard} aria-labelledby="guest-invitation-link-title">
      <h2 id="guest-invitation-link-title">Invitation link</h2>
      <p>Share this link with {guestName}’s group. They can use it to view their invitation and update their RSVP.</p>
      {waiting && <p role="status">Loading invitation link…</p>}
      {url && <>
        <label className={styles.field}>
          <span>Guest invitation URL</span>
          <input ref={input} value={url} readOnly className={styles.control} onFocus={(event) => event.currentTarget.select()} />
        </label>
        <div className={styles.rowActions}>
          <button type="button" className={styles.primary} onClick={() => void copyLink()}>Copy link</button>
          <a href={url} target="_blank" rel="noopener noreferrer" className={styles.secondary}>Open invitation</a>
        </div>
        {copied && <p role="status" className={styles.linkFeedback}>Link copied</p>}
      </>}
      {error && <p role="alert" className={styles.linkFeedback}>{error}</p>}
      {error && !url && <button type="button" className={styles.secondary} onClick={() => {
        setError("");
        setWaiting(true);
        setAttempt((previous) => previous + 1);
      }}>Try again</button>}
    </section>
  );
}
