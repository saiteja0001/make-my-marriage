"use client";

import { useEffect, useRef, useState } from "react";
import { GalleryRequestError, galleryRequest } from "./client";
import { maxBatchPhotos, photoUploadSchema } from "./validation";

type Reservation = { uploadUrl: string; objectKey: string; expiresAt: string };
type Stage = "queued" | "uploading" | "checking" | "ready" | "failed";
type Upload = {
  id: string; file: File; preview?: string; stage: Stage; progress: number;
  error?: string; retryable: boolean; reservation?: Reservation; uploaded?: boolean; reservedEvent?: string;
};
export const stageLabels = { queued: "Queued", uploading: "Uploading", checking: "Checking photo", ready: "Added to gallery", failed: "Failed" };

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

export function usePhotoUpload<Result>({ headers, reservePath, confirmPath, initialEvent, guest = false, onPublished }: {
  headers?: Record<string, string>; reservePath: string; confirmPath: string; initialEvent: string; guest?: boolean;
  onPublished?: (photo: Result) => void;
}) {
  const previews = useRef(new Set<string>());
  const running = useRef(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [eventId, setEventId] = useState(initialEvent);
  const [busy, setBusy] = useState(false);
  const [lockedEvent, setLockedEvent] = useState(false);
  const [batchMessage, setBatchMessage] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [changed, setChanged] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const nextId = useRef(0);

  useEffect(() => {
    const blobUrls = previews.current;
    return () => {
      blobUrls.forEach((url) => URL.revokeObjectURL(url));
      blobUrls.clear();
    };
  }, []);

  function choose(files: FileList | File[]) {
    if (running.current || changed || blocked) return;
    const room = maxBatchPhotos - uploads.length;
    setBatchMessage(files.length > room ? "Each batch can contain up to 20 photos. Remove files or upload this batch first." : "");
    const additions = Array.from(files).slice(0, room).map((file): Upload => {
      const parsed = photoUploadSchema.safeParse({ filename: file.name, mimeType: file.type, sizeBytes: file.size });
      const preview = parsed.success ? URL.createObjectURL(file) : undefined;
      if (preview) previews.current.add(preview);
      return {
        file, preview, id: String(nextId.current++), progress: 0, stage: parsed.success ? "queued" : "failed", retryable: parsed.success,
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
    if (running.current || !batch.length || changed || blocked) return;
    running.current = true;
    setBusy(true);
    setNeedsLogin(false);
    setBatchMessage("");
    const requestHeaders = { "Content-Type": "application/json", ...headers };
    try {
      for (const entry of batch) {
        let reservation = entry.reservation;
        let uploaded = Boolean(entry.uploaded);
        const selectedEvent = eventId || undefined;
        const details = { filename: entry.file.name, mimeType: entry.file.type, sizeBytes: entry.file.size,
          eventId: reservation ? entry.reservedEvent : selectedEvent };

        async function completeUpload() {
          if (!reservation || (!uploaded && Date.parse(reservation.expiresAt) <= Date.now())) {
            const response = await galleryRequest<{ data: Reservation }>(reservePath, {
              method: "POST", headers: requestHeaders, body: JSON.stringify(details),
            });
            reservation = response.data;
            uploaded = false;
            setLockedEvent(true);
          }
          update(entry.id, { reservation, reservedEvent: details.eventId, stage: uploaded ? "checking" : "uploading",
            progress: uploaded ? 100 : 0, error: undefined });
          if (!uploaded) {
            await directUpload(reservation, entry.file, entry.file.type, (progress) => update(entry.id, { progress }));
            uploaded = true;
            update(entry.id, { uploaded, stage: "checking", progress: 100 });
          }
          return galleryRequest<{ data: Result }>(confirmPath, {
            method: "POST", headers: requestHeaders, body: JSON.stringify({ ...details, objectKey: reservation.objectKey }),
          });
        }

        try {
          const response = await completeUpload().catch((error: unknown) => {
            if (!guest || !(error instanceof GalleryRequestError)
              || error.code !== "EVENT_UNAVAILABLE" || details.eventId === selectedEvent) throw error;
            // Resolve the old confirmation first in case it already published.
            reservation = undefined;
            uploaded = false;
            details.eventId = selectedEvent;
            return completeUpload();
          });
          update(entry.id, { stage: "ready", reservation: undefined, uploaded: false });
          onPublished?.(response.data);
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
          if (broken === "UPLOAD_GONE" || broken === "URL_EXPIRED" || broken === "UPLOAD_NOT_FOUND") { reservation = undefined; uploaded = false; }
          if (broken === "UPLOAD_INCOMPLETE") uploaded = false;
          if (guest && broken === "EVENT_UNAVAILABLE") {
            reservation = undefined;
            uploaded = false;
            setLockedEvent(false);
            setBatchMessage("This event is unavailable. Choose a different event or Wedding Memories, then retry.");
          }
          update(entry.id, {
            stage: "failed", reservation, uploaded, retryable: broken !== "INVALID_PHOTO",
            error: error instanceof Error ? error.message : "Try uploading again.",
          });
          if (error instanceof GalleryRequestError && error.status === 401) {
            setNeedsLogin(true);
            break;
          }
          if (guest && (broken === "UPLOADS_PAUSED" || broken === "NOT_FOUND")) {
            setBlocked(true);
            setBatchMessage(broken === "NOT_FOUND" ? "This gallery is no longer available." : "Guest uploads are paused. You can still view the gallery.");
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
  return { uploads, eventId, setEventId, busy, lockedEvent, batchMessage, needsLogin, changed, blocked,
    choose, remove, uploadBatch, queued, failed, ready };
}
