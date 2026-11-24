"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { GalleryPhoto } from "@/modules/photos/service";
import { galleryRequest, photoSize } from "./gallery-http";
import styles from "./gallery.module.css";

export function PhotoViewer({ photo, eventName, position, total, context, onStep, onClose, onDeleted, onRefresh }: {
  photo: GalleryPhoto; eventName: string; position: number; total: number; context: string;
  onStep: (step: number) => void; onClose: () => void; onDeleted: (id: string) => void;
  onRefresh: (id: string) => Promise<void>;
}) {
  const viewer = useRef<HTMLDialogElement>(null);
  const confirm = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState<"delete" | "download" | "refresh" | null>(null);
  const [problem, setProblem] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [failedUrl, setFailedUrl] = useState("");
  const broken = failedUrl === photo.url;

  useEffect(() => {
    const dialog = viewer.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    if (Date.parse(photo.urlExpiresAt) - Date.now() < 60_000) void onRefresh(photo.id).catch(() => {});
  }, [photo.id, photo.urlExpiresAt, onRefresh]);

  async function retryView() {
    setProblem("");
    setBusy("refresh");
    try {
      await onRefresh(photo.id);
      setFailedUrl("");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "We couldn’t open this photo. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    setProblem("");
    setBusy("download");
    try {
      const { data } = await galleryRequest<{ data: { url: string } }>(`/api/photos/${photo.id}/download`, {
        headers: { "X-Photo-Draft": context },
      });
      const anchor = document.createElement("a");
      anchor.href = data.url;
      anchor.download = photo.originalFilename;
      anchor.referrerPolicy = "no-referrer";
      anchor.click();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "We couldn’t download this photo. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setDeleteError("");
    setBusy("delete");
    try {
      await galleryRequest(`/api/photos/${photo.id}`, { method: "DELETE", headers: { "X-Photo-Draft": context } });
      confirm.current?.close();
      onDeleted(photo.id);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "We couldn’t delete this photo. Try again.");
    } finally {
      setBusy(null);
    }
  }

  function step(delta: number) {
    if (busy || confirm.current?.open) return;
    setProblem("");
    onStep(delta);
  }

  return (
    <dialog ref={viewer} className={styles.viewer} aria-labelledby="viewer-photo-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          step(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}>
      <header className={styles.viewerHeader}>
        <div>
          <h2 id="viewer-photo-title">{photo.originalFilename}</h2>
          <p>{eventName} · {photoSize(photo.sizeBytes)}</p>
        </div>
        <button type="button" className={styles.viewerAction} onClick={onClose} disabled={Boolean(busy)}>Close</button>
      </header>
      <div className={styles.fullPhoto}>
        {broken ? <div className={styles.imageError}>
          <p>This photo couldn’t be displayed.</p>
          <button type="button" className={styles.viewerAction} disabled={Boolean(busy)} onClick={() => void retryView()}>
            {busy === "refresh" ? "Refreshing…" : "Retry viewing"}
          </button>
        </div> : (
          <Image src={photo.url} alt={photo.originalFilename} fill unoptimized loading="eager" referrerPolicy="no-referrer"
            onError={() => setFailedUrl(photo.url)} />
        )}
      </div>
      {problem && <p className={styles.viewerError} role="alert">{problem}</p>}
      <footer className={styles.viewerFooter}>
        <div>
          <button type="button" className={styles.viewerAction} disabled={position <= 1 || Boolean(busy)} onClick={() => step(-1)}>Previous</button>
          <span aria-live="polite">{position} of {total}</span>
          <button type="button" className={styles.viewerAction} disabled={position >= total || Boolean(busy)} onClick={() => step(1)}>Next</button>
        </div>
        <div>
          <button type="button" className={styles.viewerAction} disabled={Boolean(busy)} onClick={() => void download()}>
            {busy === "download" ? "Preparing download…" : "Download photo"}
          </button>
          <button type="button" className={styles.viewerAction} disabled={Boolean(busy)}
            onClick={() => { setDeleteError(""); confirm.current?.showModal(); }}>Delete photo</button>
        </div>
      </footer>
      <dialog ref={confirm} className={styles.confirmDelete} aria-labelledby="delete-photo-title" aria-describedby="delete-photo-description"
        onCancel={(event) => { if (busy === "delete") event.preventDefault(); }}>
        <h2 id="delete-photo-title">Delete this photo?</h2>
        {!broken && <div className={styles.deletePreview}><Image src={photo.url} alt="" fill unoptimized referrerPolicy="no-referrer" /></div>}
        <p id="delete-photo-description"><strong>{photo.originalFilename}</strong> will be permanently deleted from this wedding gallery.</p>
        {deleteError && <p role="alert" className={styles.error}>{deleteError}</p>}
        <div className={styles.dialogActions}>
          <button type="button" className={styles.secondary} disabled={busy === "delete"} onClick={() => confirm.current?.close()}>Cancel</button>
          <button type="button" className={styles.danger} disabled={busy === "delete"} onClick={() => void remove()}>
            {busy === "delete" ? "Deleting…" : "Delete photo"}
          </button>
        </div>
      </dialog>
    </dialog>
  );
}
