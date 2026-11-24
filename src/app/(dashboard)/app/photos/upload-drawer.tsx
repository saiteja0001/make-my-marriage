"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { GalleryPhoto } from "@/modules/photos/service";
import { maxBatchPhotos, photoUploadSchema } from "@/modules/photos/validation";
import { useWorkspaceDraft } from "../_components/workspace-draft";
import { WorkspaceFormLink } from "../_components/workspace-form-link";
import { GalleryRequestError, galleryRequest, photoSize, type GalleryEvent } from "./gallery-http";
import styles from "./gallery.module.css";

type Reservation = { uploadUrl: string; objectKey: string; expiresAt: string };
type Stage = "queued" | "uploading" | "checking" | "ready" | "failed";
type Upload = {
  id: string; file: File; preview?: string; stage: Stage; progress: number;
  error?: string; retryable: boolean; reservation?: Reservation; uploaded?: boolean;
};
const stageLabels = { queued: "Queued", uploading: "Uploading", checking: "Checking photo", ready: "Added to gallery", failed: "Failed" };

function directUpload(reservation: Reservation, file: File, contentType: string, onProgress: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", reservation.uploadUrl);
    request.timeout = 180_000;
    request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(100, Math.floor(100 * event.loaded / event.total)));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else if (request.status === 403 || Date.parse(reservation.expiresAt) <= Date.now()) {
        reject(new GalleryRequestError(403, "URL_EXPIRED", "The upload link expired. Retry to get a new link."));
      } else reject(new Error("The upload could not finish. Try again."));
    };
    request.onerror = () => reject(new Error(Date.parse(reservation.expiresAt) <= Date.now()
      ? "The upload link expired. Try again." : "We couldn’t connect to photo storage. Try again."));
    request.ontimeout = () => reject(new Error("The upload timed out. Try again."));
    request.send(file);
  });
}

export function UploadDrawer({ context, events, initialEvent, onClose, onPublished }: {
  context: string; events: GalleryEvent[]; initialEvent: string;
  onClose: () => void; onPublished: (photo: GalleryPhoto) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const previews = useRef(new Set<string>());
  const running = useRef(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [eventId, setEventId] = useState(initialEvent);
  const [busy, setBusy] = useState(false);
  const [lockedEvent, setLockedEvent] = useState(false);
  const [batchMessage, setBatchMessage] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [changed, setChanged] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { requestLeave } = useWorkspaceDraft(uploads.some(({ stage }) => stage !== "ready"), busy);

  useEffect(() => {
    const panel = dialog.current;
    const blobUrls = previews.current;
    panel?.showModal();
    return () => {
      panel?.close();
      blobUrls.forEach((url) => URL.revokeObjectURL(url));
      blobUrls.clear();
    };
  }, []);

  function choose(files: FileList | File[]) {
    if (running.current || changed) return;
    const room = maxBatchPhotos - uploads.length;
    setBatchMessage(files.length > room ? "Each batch can contain up to 20 photos. Remove files or upload this batch first." : "");
    const additions = Array.from(files).slice(0, room).map((file): Upload => {
      const parsed = photoUploadSchema.safeParse({ filename: file.name, mimeType: file.type, sizeBytes: file.size });
      const preview = parsed.success ? URL.createObjectURL(file) : undefined;
      if (preview) previews.current.add(preview);
      return {
        file, preview, id: crypto.randomUUID(), progress: 0, stage: parsed.success ? "queued" : "failed", retryable: parsed.success,
        error: parsed.success ? undefined : parsed.error.issues[0]?.message,
      };
    });
    setUploads((previous) => [...previous, ...additions]);
  }

  function remove(upload: Upload) {
    if (upload.preview) {
      URL.revokeObjectURL(upload.preview);
      previews.current.delete(upload.preview);
    }
    setUploads((previous) => previous.filter(({ id }) => id !== upload.id));
    setBatchMessage("");
  }

  function update(id: string, values: Partial<Upload>) {
    setUploads((previous) => previous.map((entry) => entry.id === id ? { ...entry, ...values } : entry));
  }

  async function uploadBatch(batch: Upload[]) {
    if (running.current || !batch.length || changed) return;
    running.current = true;
    setBusy(true);
    setNeedsLogin(false);
    setBatchMessage("");
    const headers = { "Content-Type": "application/json", "X-Photo-Draft": context };
    try {
      for (const entry of batch) {
        let reservation = entry.reservation;
        let uploaded = Boolean(entry.uploaded);
        const details = { filename: entry.file.name, mimeType: entry.file.type, sizeBytes: entry.file.size, eventId: eventId || undefined };
        try {
          if (!reservation || (!uploaded && Date.parse(reservation.expiresAt) <= Date.now())) {
            const response = await galleryRequest<{ data: Reservation }>("/api/photos/upload-url", {
              method: "POST", headers, body: JSON.stringify(details),
            });
            reservation = response.data;
            uploaded = false;
            setLockedEvent(true);
          }
          update(entry.id, { reservation, stage: uploaded ? "checking" : "uploading", progress: uploaded ? 100 : 0, error: undefined });
          if (!uploaded) {
            await directUpload(reservation, entry.file, entry.file.type, (progress) => update(entry.id, { progress }));
            uploaded = true;
            update(entry.id, { uploaded, stage: "checking", progress: 100 });
          }
          const response = await galleryRequest<{ data: GalleryPhoto }>("/api/photos", {
            method: "POST", headers, body: JSON.stringify({ ...details, objectKey: reservation.objectKey }),
          });
          update(entry.id, { stage: "ready", reservation: undefined, uploaded: false });
          onPublished(response.data);
        } catch (error) {
          if (error instanceof GalleryRequestError && error.code === "DRAFT_CHANGED") {
            previews.current.forEach((url) => URL.revokeObjectURL(url));
            previews.current.clear();
            setUploads([]);
            setChanged(true);
            setBatchMessage(error.message);
            break;
          }
          const broken = error instanceof GalleryRequestError ? error.code : "";
          if (broken === "UPLOAD_GONE" || broken === "URL_EXPIRED") { reservation = undefined; uploaded = false; }
          if (broken === "UPLOAD_INCOMPLETE") uploaded = false;
          update(entry.id, {
            stage: "failed", reservation, uploaded, retryable: broken !== "INVALID_PHOTO",
            error: error instanceof Error ? error.message : "Try uploading again.",
          });
          if (error instanceof GalleryRequestError && error.status === 401) {
            setNeedsLogin(true);
            break;
          }
          if (broken === "RATE_LIMITED" || broken === "EVENT_UNAVAILABLE" || broken === "STORAGE_UNAVAILABLE") break;
        }
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  const queued = uploads.filter(({ stage }) => stage === "queued");
  const failed = uploads.filter(({ stage, retryable }) => stage === "failed" && retryable);
  const ready = uploads.filter(({ stage }) => stage === "ready").length;
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
