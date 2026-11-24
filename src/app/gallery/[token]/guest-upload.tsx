"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { photoSize } from "@/modules/photos/client";
import { stageLabels, usePhotoUpload } from "@/modules/photos/client-upload";
import styles from "./guest-gallery.module.css";

export function GuestUpload({ path, names, events, initialEvent, onClose }: {
  path: string; names: string; events: { id: string; name: string }[]; initialEvent: string;
  onClose: (refresh: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const { uploads, eventId, setEventId, busy, lockedEvent, batchMessage, blocked,
    choose, remove, uploadBatch, queued, failed, ready } = usePhotoUpload<{ id: string }>({
    reservePath: path + "/upload-url", confirmPath: path + "/photos", initialEvent, guest: true,
  });

  useEffect(() => {
    const panel = dialog.current;
    panel?.showModal();
    return () => panel?.close();
  }, []);

  function close() {
    if (!busy) onClose(ready > 0 || blocked);
  }

  const allAdded = ready > 0 && ready === uploads.length;

  return <dialog ref={dialog} className={styles.uploadSheet} aria-labelledby="guest-upload-title"
    onCancel={(event) => { event.preventDefault(); close(); }}>
    <header className={styles.uploadHeading}>
      <div><h2 id="guest-upload-title">Contribute wedding memories</h2><p>Share photos with {names}.</p></div>
      <button type="button" className={styles.uploadSecondary} onClick={close} disabled={busy}>Close</button>
    </header>
    <label className={styles.eventField}>Wedding event
      <select value={eventId} disabled={busy || lockedEvent || blocked} onChange={(event) => setEventId(event.currentTarget.value)}>
        <option value="">Wedding Memories</option>
        {events.map(({ id, name }) => <option value={id} key={id}>{name}</option>)}
      </select>
    </label>
    <div className={styles.pickPhotos}>
      <p>JPEG, PNG, or WebP. Up to 10 MiB per photo and 20 photos per batch.</p>
      <input ref={picker} type="file" multiple accept="image/jpeg,image/png,image/webp" hidden
        onChange={(event) => {
          if (event.currentTarget.files) choose(event.currentTarget.files);
          event.currentTarget.value = "";
        }} />
      <button type="button" className={styles.uploadSecondary} disabled={busy || blocked} onClick={() => picker.current?.click()}>Choose photos</button>
    </div>
    {batchMessage && <p className={styles.uploadProblem} role="alert">{batchMessage}</p>}
    {uploads.length > 0 && <>
      <div className={styles.uploadSummary}>
        <strong aria-live="polite">{ready} of {uploads.length} added</strong>
        <progress aria-label="Photos added to gallery" value={ready} max={uploads.length} />
        {allAdded && <p role="status">Your photos were added to the gallery.</p>}
      </div>
      <ul className={styles.uploadQueue} aria-label="Upload queue">
        {uploads.map((entry) => <li key={entry.id} className={styles.uploadItem}>
          <span className={styles.uploadThumb}>{entry.preview && <Image src={entry.preview} alt="" fill unoptimized />}</span>
          <div className={styles.uploadMeta}>
            <strong>{entry.file.name}</strong>
            <p><span data-stage={entry.stage}>{stageLabels[entry.stage]}</span> · {photoSize(entry.file.size)}</p>
            {entry.stage === "uploading" && <progress aria-label={`Upload progress for ${entry.file.name}`} value={entry.progress} max={100} />}
            {entry.error && <p className={styles.fileProblem}>{entry.error}</p>}
          </div>
          {(entry.stage === "queued" || entry.stage === "failed") && !blocked && <div className={styles.fileActions}>
            {entry.stage === "failed" && entry.retryable && <button type="button" className={styles.uploadPrimary} disabled={busy}
              aria-label={`Retry ${entry.file.name}`} onClick={() => void uploadBatch([entry])}>Retry</button>}
            <button type="button" className={styles.uploadSecondary} disabled={busy}
              aria-label={`Remove ${entry.file.name}`} onClick={() => remove(entry)}>Remove</button>
          </div>}
        </li>)}
      </ul>
    </>}
    <footer className={styles.uploadFooter}>
      {!blocked && queued.length > 0 && <button type="button" className={styles.uploadPrimary} disabled={busy}
        onClick={() => void uploadBatch(queued)}>Upload photos ({queued.length})</button>}
      {!blocked && failed.length > 1 && <button type="button" className={styles.uploadPrimary} disabled={busy}
        onClick={() => void uploadBatch(failed)}>Retry failed photos ({failed.length})</button>}
      <button type="button" className={styles.uploadSecondary} disabled={busy} onClick={close}>
        {ready > 0 && !allAdded ? `Back to gallery (keep ${ready} added)` : "Back to gallery"}
      </button>
    </footer>
  </dialog>;
}
