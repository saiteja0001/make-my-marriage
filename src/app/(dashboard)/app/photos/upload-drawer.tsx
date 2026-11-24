"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { GalleryPhoto } from "@/modules/photos/service";
import { stageLabels, usePhotoUpload } from "@/modules/photos/client-upload";
import { useWorkspaceDraft } from "../_components/workspace-draft";
import { WorkspaceFormLink } from "../_components/workspace-form-link";
import { photoSize, type GalleryEvent } from "@/modules/photos/client";
import styles from "./gallery.module.css";

export function UploadDrawer({ context, events, initialEvent, onClose, onPublished }: {
  context: string; events: GalleryEvent[]; initialEvent: string;
  onClose: () => void; onPublished: (photo: GalleryPhoto) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { uploads, eventId, setEventId, busy, lockedEvent, batchMessage, needsLogin, changed,
    choose, remove, uploadBatch, queued, failed, ready } = usePhotoUpload({
    headers: { "X-Photo-Draft": context }, reservePath: "/api/photos/upload-url", confirmPath: "/api/photos",
    initialEvent, onPublished,
  });
  const { requestLeave } = useWorkspaceDraft(uploads.some(({ stage }) => stage !== "ready"), busy);
  useEffect(() => {
    const panel = dialog.current;
    panel?.showModal();
    return () => panel?.close();
  }, []);
  const close = () => requestLeave(onClose);
  return (
    <dialog ref={dialog} className={styles.drawer} aria-labelledby="upload-photos-title" onCancel={(event) => { event.preventDefault(); close(); }}>
      <header className={styles.dialogHeading}>
        <h2 id="upload-photos-title">Upload photos</h2>
        <button type="button" className={styles.textAction} onClick={close} disabled={busy} aria-label="Close upload drawer">Close</button>
      </header>
      <p className={styles.help}>JPEG, PNG, or WebP. Up to 10 MiB per photo and 20 photos per batch.</p>
      {needsLogin && <div className={styles.problem} role="status">
        <p>Your session expired. Sign in and retry to continue with these photos.</p>
        <Link href="/login" target="_blank" rel="noopener">Open login in a new tab</Link>
      </div>}
      <label className={styles.field}>Wedding event
        <select value={eventId} disabled={busy || lockedEvent || changed} onChange={(event) => setEventId(event.currentTarget.value)}>
          <option value="">Wedding Memories</option>
          {events.filter(({ archived }) => !archived).map(({ id, name }) => <option value={id} key={id}>{name}</option>)}
        </select>
      </label>
      <div className={styles.dropArea} data-dragging={dragging}
        onDragOver={(event) => { event.preventDefault(); if (!busy && !changed) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files); }}>
        <p>Drag and drop photos here</p>
        <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
          onChange={(event) => { if (event.currentTarget.files) choose(event.currentTarget.files); event.currentTarget.value = ""; }} />
        <button type="button" className={styles.secondary} disabled={busy || changed} onClick={() => picker.current?.click()}>Browse files</button>
      </div>
      {batchMessage && <p role="alert" className={styles.problem}>{batchMessage}</p>}
      {changed && <WorkspaceFormLink href="/app/photos" className={styles.secondary}>Reopen gallery</WorkspaceFormLink>}
      {uploads.length > 0 && <ul className={styles.queue} aria-label="Upload queue">
        {uploads.map((entry) => (
          <li key={entry.id} className={styles.queueRow}>
            <div className={styles.queuePreview}>{entry.preview && <Image src={entry.preview} alt="" fill unoptimized />}</div>
            <div className={styles.queueInfo}>
              <strong>{entry.file.name}</strong>
              <p>{photoSize(entry.file.size)} · <span data-stage={entry.stage}>{stageLabels[entry.stage]}</span></p>
              {entry.stage === "uploading" && <progress aria-label={`Upload progress for ${entry.file.name}`} value={entry.progress} max={100} />}
              {entry.error && <p className={styles.error}>{entry.error}</p>}
            </div>
            <div className={styles.queueActions}>
              {entry.stage === "failed" && entry.retryable && <button type="button" disabled={busy} className={styles.textAction}
                aria-label={`Retry ${entry.file.name}`} onClick={() => void uploadBatch([entry])}>Retry</button>}
              {(entry.stage === "queued" || entry.stage === "failed") && <button type="button" disabled={busy} className={styles.textAction}
                aria-label={`Remove ${entry.file.name}`} onClick={() => remove(entry)}>Remove</button>}
            </div>
          </li>
        ))}
      </ul>}
      <footer className={styles.uploadActions}>
        <p aria-live="polite">{uploads.length ? `${ready} of ${uploads.length} added` : ""}</p>
        <div>
          <button type="button" className={styles.secondary} onClick={close} disabled={busy}>Done</button>
          {failed.length > 0 && <button type="button" disabled={busy} className={styles.secondary} onClick={() => void uploadBatch(failed)}>Retry failed uploads</button>}
          {queued.length > 0 && <button type="button" disabled={busy} className={styles.primary} onClick={() => void uploadBatch(queued)}>Start upload</button>}
        </div>
      </footer>
    </dialog>
  );
}
