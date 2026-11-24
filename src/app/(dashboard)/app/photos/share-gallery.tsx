"use client";

import { useEffect, useRef, useState } from "react";
import type { GallerySettings } from "@/modules/photos/sharing";
import { galleryRequest } from "@/modules/photos/client";
import styles from "./gallery.module.css";

export function ShareGallery({ context, onClose }: { context: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<GallerySettings>();
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [retryValue, setRetryValue] = useState<Partial<Pick<GallerySettings, "isEnabled" | "guestUploadsEnabled">>>();
  const [saved, setSaved] = useState(false);

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

  async function save(changes: NonNullable<typeof retryValue>) {
    setPending(true);
    setSaved(false);
    setProblem("");
    setCopyStatus("");
    setRetryValue(undefined);
    try {
      const { data } = await galleryRequest<{ data: GallerySettings }>("/api/gallery/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Photo-Draft": context },
        body: JSON.stringify(changes),
      });
      setSettings(data);
      setSaved(true);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "We couldn’t update gallery sharing.");
      setRetryValue(changes);
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
          <p>Manage who can view and contribute photos.</p>
        </div>
        <button type="button" className={styles.secondary} disabled={pending} onClick={onClose}>Close</button>
      </header>
      {settings ? <div className={styles.shareContent}>
        <button type="button" className={styles.shareSwitch} role="switch" aria-label="Guest viewing"
          aria-describedby="sharing-description" aria-checked={settings.isEnabled}
          disabled={pending} onClick={() => void save({ isEnabled: !settings.isEnabled })}>
          <strong>Guest viewing</strong><span>{settings.isEnabled ? "On" : "Off"}</span><i aria-hidden="true" />
        </button>
        <p id="sharing-description" className={styles.shareNotice}>Anyone with the link can view all photos in this gallery while sharing is on.</p>
        <div className={styles.uploadSetting}>
          <button type="button" className={styles.shareSwitch} role="switch" aria-label="Allow guest uploads"
            aria-describedby="guest-upload-description" aria-checked={settings.guestUploadsEnabled}
            disabled={pending || !settings.isEnabled} onClick={() => void save({ guestUploadsEnabled: !settings.guestUploadsEnabled })}>
            <strong>Allow guest uploads</strong><span>{settings.guestUploadsEnabled ? "On" : "Off"}</span><i aria-hidden="true" />
          </button>
          <p id="guest-upload-description">{!settings.isEnabled ? "Turn on guest viewing to allow uploads."
            : settings.guestUploadsEnabled ? "Guests can add photos without signing in. Up to 10 MiB per photo and 20 photos per batch."
              : "Guests can view the gallery. Turn on uploads to let them contribute photos."}</p>
        </div>
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
        {saved && <p role="status">Sharing settings saved.</p>}
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
