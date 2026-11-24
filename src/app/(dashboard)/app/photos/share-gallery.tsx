"use client";

import { useEffect, useRef, useState } from "react";
import type { GallerySettings } from "@/modules/photos/sharing";
import { galleryRequest } from "./gallery-http";
import styles from "./gallery.module.css";

export function ShareGallery({ context, onClose }: { context: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<GallerySettings>();
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [retryValue, setRetryValue] = useState<boolean>();

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void galleryRequest<{ data: GallerySettings }>("/api/gallery/settings", {
      signal: controller.signal, headers: { "X-Photo-Draft": context },
    }).then(({ data }) => setSettings(data)).catch((error: Error) => {
      if (!controller.signal.aborted) setProblem(error.message);
    });
    return () => controller.abort();
  }, [context, attempt]);

  async function save(isEnabled: boolean) {
    setPending(true);
    setProblem("");
    setCopyStatus("");
    setRetryValue(undefined);
    try {
      const { data } = await galleryRequest<{ data: GallerySettings }>("/api/gallery/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Photo-Draft": context },
        body: JSON.stringify({ isEnabled }),
      });
      setSettings(data);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "We couldn’t update gallery sharing.");
      setRetryValue(isEnabled);
    } finally {
      setPending(false);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("Link copied");
    } catch {
      linkRef.current?.focus();
      linkRef.current?.select();
      setCopyStatus("Copy the selected link.");
    }
  }

  return (
    <dialog ref={dialogRef} className={`${styles.drawer} ${styles.sharingDrawer}`} aria-labelledby="share-gallery-title"
      onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}>
      <header className={styles.dialogHeading}>
        <div>
          <h2 id="share-gallery-title">Share gallery</h2>
          <p>Invite guests to view your wedding photos.</p>
        </div>
        <button type="button" className={styles.secondary} disabled={pending} onClick={onClose}>Close</button>
      </header>
      {settings ? <div className={styles.shareContent}>
        <button type="button" className={styles.shareSwitch} role="switch" aria-label="Guest viewing"
          aria-describedby="sharing-description" aria-checked={settings.isEnabled}
          disabled={pending} onClick={() => void save(!settings.isEnabled)}>
          <strong>Guest viewing</strong><span>{settings.isEnabled ? "On" : "Off"}</span><i aria-hidden="true" />
        </button>
        <p id="sharing-description" className={styles.shareNotice}>Anyone with the link can view all photos in this gallery while sharing is on.</p>
        {settings.galleryUrl ? <div className={styles.shareLink}>
          <label htmlFor="guest-gallery-link">Guest gallery link</label>
          <input id="guest-gallery-link" ref={linkRef} value={settings.galleryUrl} readOnly />
          <div className={styles.headingActions}>
            <button type="button" className={styles.primary} disabled={pending}
              onClick={() => void copy(settings.galleryUrl!)}>Copy link</button>
            <a className={styles.secondary} href={settings.galleryUrl} target="_blank" rel="noopener noreferrer">Open guest gallery</a>
          </div>
          <p role="status">{copyStatus}</p>
        </div> : <p>Only wedding members can view your photos. If you’ve shared a link before, turning guest viewing back on restores access to that link.</p>}
        {pending && <p role="status">Saving sharing settings…</p>}
      </div> : !problem && <p role="status">Loading sharing settings…</p>}
      {problem && <div className={styles.shareContent}>
        <p className={styles.problem} role="alert">{problem}</p>
        <button type="button" className={styles.secondary} onClick={() => {
          if (retryValue !== undefined) void save(retryValue);
          else { setProblem(""); setAttempt((current) => current + 1); }
        }}>Try again</button>
      </div>}
    </dialog>
  );
}
