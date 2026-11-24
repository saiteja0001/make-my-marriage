"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatEventDay } from "@/modules/events/wedding-time";
import type { GalleryPhoto } from "@/modules/photos/service";
import { galleryRequest, GalleryRequestError, photoSize, type GalleryEvent, type GalleryResult } from "./gallery-http";
import { PhotoViewer } from "./photo-viewer";
import { UploadDrawer } from "./upload-drawer";
import styles from "./gallery.module.css";

function pageUrl(filter: string, cursor?: string) {
  const query = new URLSearchParams();
  if (filter !== "all") query.set("eventId", filter);
  if (cursor) query.set("cursor", cursor);
  return query.size ? "/api/photos?" + query : "/api/photos";
}

function TileImage({ photo, onRefresh }: { photo: GalleryPhoto; onRefresh: (id: string) => Promise<void> }) {
  const attemptedUrl = useRef<string | null>(null);
  const [failure, setFailure] = useState<{ url: string; refreshing: boolean }>();

  async function recoverPreview() {
    const { id, url } = photo;
    if (attemptedUrl.current === url) return;
    if (attemptedUrl.current !== null) {
      setFailure({ url, refreshing: false });
      return;
    }

    attemptedUrl.current = url;
    setFailure({ url, refreshing: true });
    try {
      await onRefresh(id);
    } catch {
      // A missing photo or failed refresh falls back to the placeholder.
    } finally {
      setFailure((current) => current?.url === url ? { url, refreshing: false } : current);
    }
  }

  if (failure?.url === photo.url) {
    return <span className={styles.tileError}>{failure.refreshing ? "Refreshing preview…" : "Preview unavailable"}</span>;
  }
  return <Image src={photo.url} alt="" fill unoptimized loading="lazy" referrerPolicy="no-referrer"
    onLoad={() => { attemptedUrl.current = null; }} onError={() => void recoverPreview()} />;
}

export function Gallery({ events, context, timeZone }: { events: GalleryEvent[]; context: string; timeZone: string }) {
  const [filter, setFilter] = useState("all");
  const [gallery, setGallery] = useState<GalleryResult | null>(null);
  const [error, setError] = useState<{ message: string; status?: number; code?: string }>();
  const [moreError, setMoreError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const paging = useRef<AbortController | null>(null);
  const photos = gallery?.data ?? [];
  const index = photos.findIndex(({ id }) => id === activeId);
  const activePhoto = photos[index];

  useEffect(() => {
    const request = new AbortController();
    void galleryRequest<GalleryResult>(pageUrl(filter), { signal: request.signal, headers: { "X-Photo-Draft": context } })
      .then((result) => { if (!request.signal.aborted) setGallery(result); })
      .catch((error: unknown) => {
        if (!request.signal.aborted) setError(error instanceof GalleryRequestError ? error : { message: "We couldn’t load your photos. Try again." });
      });
    return () => {
      request.abort();
      paging.current?.abort();
    };
  }, [filter, context, refreshKey]);

  function chooseFilter(next: string) {
    if (next === filter) return;
    paging.current?.abort();
    setLoadingMore(false);
    setMoreError("");
    setError(undefined);
    setGallery(null);
    setFilter(next);
  }

  function reload() {
    paging.current?.abort();
    setLoadingMore(false);
    setMoreError("");
    setError(undefined);
    setGallery(null);
    setRefreshKey((previous) => previous + 1);
  }

  async function loadMore() {
    const cursor = gallery?.pagination.nextCursor;
    if (!cursor || loadingMore) return;
    const request = new AbortController();
    paging.current = request;
    setLoadingMore(true);
    setMoreError("");
    try {
      const next = await galleryRequest<GalleryResult>(pageUrl(filter, cursor), {
        signal: request.signal, headers: { "X-Photo-Draft": context },
      });
      if (!request.signal.aborted) setGallery((previous) => {
        if (!previous) return next;
        const seen = new Set(previous.data.map(({ id }) => id));
        return { ...next, data: [...previous.data, ...next.data.filter(({ id }) => !seen.has(id))] };
      });
    } catch (error) {
      if (!request.signal.aborted) setMoreError(error instanceof Error ? error.message : "We couldn’t load the next photos. Try again.");
    } finally {
      if (!request.signal.aborted) setLoadingMore(false);
    }
  }

  function eventName(eventId: string | null) {
    if (!eventId) return "Wedding Memories";
    const event = events.find(({ id }) => id === eventId);
    return event ? event.name + (event.archived ? " (archived)" : "") : "Unavailable event";
  }

  function publish(photo: GalleryPhoto) {
    const matches = filter === "all" || (filter === "other" ? !photo.eventId : photo.eventId === filter);
    if (!matches) return;
    if (!gallery) { reload(); return; }
    setGallery((previous) => {
      if (!previous || previous.data.some(({ id }) => id === photo.id)) return previous;
      const data = [photo, ...previous.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
      return { ...previous, data, total: previous.total + 1 };
    });
  }

  const refreshPhoto = useCallback(async (id: string) => {
    const { data } = await galleryRequest<{ data: GalleryPhoto }>(`/api/photos/${id}`, { headers: { "X-Photo-Draft": context } });
    setGallery((previous) => previous && { ...previous, data: previous.data.map((photo) => photo.id === id ? data : photo) });
  }, [context]);

  function openPhoto(photo: GalleryPhoto) {
    setActiveId(photo.id);
  }

  function deleted(id: string) {
    const replacement = photos[index + 1] ?? photos[index - 1];
    setActiveId(replacement?.id ?? null);
    setGallery((previous) => previous && {
      ...previous, data: previous.data.filter((photo) => photo.id !== id), total: Math.max(0, previous.total - 1),
    });
    setNotice("Photo deleted.");
  }

  const filters = [
    { id: "all", label: "All photos" },
    ...events.map(({ id, name, archived }) => ({ id, label: name + (archived ? " (archived)" : "") })),
    { id: "other", label: "Wedding Memories" },
  ];
  const total = gallery?.total ?? 0;

  return (
    <>
      <header className={styles.heading}>
        <div>
          <h1>Wedding Gallery</h1>
          <p>Visible to your wedding members.</p>
        </div>
        <button type="button" className={styles.primary} onClick={() => { setUploadOpen(true); setNotice(""); }}>Upload photos</button>
      </header>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      <div className={styles.filterBar}>
        <div className={styles.filters} role="group" aria-label="Filter photos by event">
          {filters.map(({ id, label }) => (
            <button type="button" key={id} aria-pressed={filter === id} onClick={() => chooseFilter(id)}>{label}</button>
          ))}
        </div>
        {gallery && <p className={styles.photoCount}>{total.toLocaleString("en-IN")} {total === 1 ? "photo" : "photos"}</p>}
      </div>
      {error ? <section className={styles.empty} aria-label="Gallery error">
        <h2>Photos couldn’t load</h2>
        <p>{error.message}</p>
        {error.status === 401 ? <Link href="/login" className={styles.primary}>Sign in</Link>
          : <button type="button" className={styles.secondary} onClick={error.code === "DRAFT_CHANGED" ? () => window.location.reload() : reload}>Try again</button>}
      </section> : !gallery ? <p className={styles.loading} role="status">Loading photos…</p>
        : photos.length ? (
          <ul className={styles.grid} aria-label="Wedding photos">
            {photos.map((photo) => (
              <li key={photo.id} className={styles.tile}>
                <button type="button" className={styles.tileButton} aria-label={`View ${photo.originalFilename}`} onClick={() => openPhoto(photo)}>
                  <span className={styles.cover}>
                    <TileImage photo={photo} onRefresh={refreshPhoto} />
                    <span className={styles.mobileLabel}>{eventName(photo.eventId)}</span>
                  </span>
                  <span className={styles.tileMeta}>
                    <strong>{photo.originalFilename}</strong>
                    <span className={styles.tileDetails}>
                      <span>{eventName(photo.eventId)}</span>
                      <time dateTime={photo.createdAt}>{formatEventDay(photo.createdAt, timeZone)}</time>
                      <span>{photoSize(photo.sizeBytes)}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : <section className={styles.empty} aria-label="Empty gallery">
          <h2>{filter === "all" ? "Your gallery is empty" : "No photos match this filter"}</h2>
          <p>{filter === "all" ? "Add your first wedding photos to start the gallery." : "Choose another event or browse all wedding photos."}</p>
          {filter === "all" ?
            <button type="button" className={styles.primary} onClick={() => setUploadOpen(true)}>Upload your first photos</button>
            : <button type="button" className={styles.secondary} onClick={() => chooseFilter("all")}>Back to all photos</button>}
        </section>}
      {moreError && <p className={styles.problem} role="alert">{moreError}</p>}
      {gallery?.pagination.nextCursor && <div className={styles.pagination}>
        <p>Showing {photos.length.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")} photos</p>
        <button type="button" className={styles.secondary} disabled={loadingMore} onClick={() => void loadMore()}>
          {loadingMore ? "Loading more…" : moreError ? "Retry loading photos" : "Load more photos"}
        </button>
      </div>}
      {uploadOpen && <UploadDrawer
        context={context} events={events} initialEvent={events.some(({ id, archived }) => id === filter && !archived) ? filter : ""}
        onClose={() => setUploadOpen(false)} onPublished={publish} />}
      {activePhoto && <PhotoViewer photo={activePhoto} eventName={eventName(activePhoto.eventId)} position={index + 1}
        total={photos.length} context={context} onStep={(step) => {
          const next = photos[index + step];
          if (next) openPhoto(next);
        }} onClose={() => setActiveId(null)} onDeleted={deleted} onRefresh={refreshPhoto} />}
    </>
  );
}
