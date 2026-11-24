"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { sharedGallery, SharedPhoto } from "@/modules/photos/sharing";
import { GuestUpload } from "./guest-upload";
import styles from "./guest-gallery.module.css";

type Details = NonNullable<Awaited<ReturnType<typeof sharedGallery>>>;
type PhotoPage = { data: SharedPhoto[]; pagination: { nextCursor: string | null }; total: number };

class GalleryUnavailable extends Error {}

async function load<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { cache: "no-store", signal });
  if (response.status === 404) throw new GalleryUnavailable();
  if (!response.ok) throw new Error("Please try again.");
  return response.json();
}

function GuestPhoto({ photo, label, refresh, full = false, onUnavailable }: {
  photo: SharedPhoto; label: string; refresh: () => Promise<SharedPhoto>;
  full?: boolean; onUnavailable: () => void;
}) {
  const [replacement, setReplacement] = useState("");
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  async function retry() {
    setRefreshing(true);
    try {
      const next = await refresh();
      setReplacement(next.url);
      setFailed(false);
    } catch (error) {
      if (error instanceof GalleryUnavailable) onUnavailable();
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }
  if (failed || refreshing) return <span className={styles.imageFeedback}>
    {refreshing ? "Refreshing photo…" : "Photo unavailable"}
    {failed && full && <button type="button" disabled={refreshing} onClick={() => void retry()}>Retry photo</button>}
  </span>;
  return <Image src={replacement || photo.url} alt={label} fill unoptimized referrerPolicy="no-referrer"
    loading={full || replacement ? "eager" : "lazy"} onError={() => {
      if (replacement) setFailed(true);
      else void retry();
    }} />;
}

function Viewer({ photo, eventName, position, total, close, step, refresh, onUnavailable }: {
  photo: SharedPhoto; position: number; total: number; close: () => void;
  eventName: string;
  step: (amount: number) => void; refresh: () => Promise<SharedPhoto>; onUnavailable: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className={styles.viewer} aria-label="Wedding photo viewer"
    onCancel={(event) => { event.preventDefault(); close(); }}
    onKeyDown={(event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        step(event.key === "ArrowLeft" ? -1 : 1);
      }
    }}>
    <header><div><span aria-live="polite">Photo {position} of {total}</span><p>{eventName}</p></div>
      <button type="button" onClick={close}>Close</button></header>
    <div className={styles.fullPhoto}><GuestPhoto key={photo.id} photo={photo} label="Wedding photo" full
      refresh={refresh} onUnavailable={onUnavailable} /></div>
    <footer>
      <button type="button" onClick={() => step(-1)} disabled={position <= 1}>Previous</button>
      <button type="button" onClick={() => step(1)} disabled={position >= total}>Next</button>
    </footer>
  </dialog>;
}

export function GuestGallery({ token }: { token: string }) {
  const base = `/api/public/galleries/${encodeURIComponent(token)}`;
  const [details, setDetails] = useState<Details>();
  const [photos, setPhotos] = useState<PhotoPage>();
  const [filter, setFilter] = useState("all");
  const [attempt, setAttempt] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const [problem, setProblem] = useState("");
  const [moreProblem, setMoreProblem] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [active, setActive] = useState<number>();
  const [uploadOpen, setUploadOpen] = useState(false);
  const paging = useRef<AbortController | null>(null);
  const filterQuery = filter === "all" ? "" : `?eventId=${encodeURIComponent(filter)}`;

  useEffect(() => {
    const controller = new AbortController();
    void load<{ data: Details }>(base, controller.signal).then(({ data }) => {
      if (!controller.signal.aborted) setDetails(data);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof GalleryUnavailable) setUnavailable(true);
      else setProblem("We couldn’t open the gallery.");
    });
    return () => controller.abort();
  }, [base, attempt]);

  useEffect(() => {
    const controller = new AbortController();
    void load<PhotoPage>(base + "/photos" + filterQuery, controller.signal).then((page) => {
      if (!controller.signal.aborted) setPhotos(page);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof GalleryUnavailable) setUnavailable(true);
      else setProblem("We couldn’t load the photos.");
    });
    return () => { controller.abort(); paging.current?.abort(); };
  }, [base, filterQuery, attempt]);

  function reset() {
    paging.current?.abort();
    setPhotos(undefined);
    setLoadingMore(false);
    setMoreProblem(false);
    setProblem("");
  }

  async function loadMore(cursor: string) {
    const controller = new AbortController();
    paging.current = controller;
    setMoreProblem(false);
    setLoadingMore(true);
    try {
      const query = new URLSearchParams(filterQuery);
      query.set("cursor", cursor);
      const page = await load<PhotoPage>(base + "/photos?" + query, controller.signal);
      if (!controller.signal.aborted) setPhotos((current) => {
        if (!current) return page;
        const seen = new Set(current.data.map(({ id }) => id));
        return { ...page, data: [...current.data, ...page.data.filter(({ id }) => !seen.has(id))] };
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof GalleryUnavailable) setUnavailable(true);
      else setMoreProblem(true);
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }

  async function refreshPhoto(id: string) {
    try {
      return (await load<{ data: SharedPhoto }>(base + "/photos/" + id)).data;
    } catch (error) {
      if (error instanceof GalleryUnavailable) {
        // A removed photo and a disabled gallery use the same individual-photo response.
        await load(base);
        throw new Error("Photo unavailable.");
      }
      throw error;
    }
  }

  const selected = active === undefined ? undefined : photos?.data[active];
  const filters = [{ id: "all", name: "All photos" }, ...(details?.events ?? []), { id: "other", name: "Wedding Memories" }];
  const eventName = (id: string | null) => details?.events.find((event) => event.id === id)?.name ?? "Wedding Memories";
  const names = details && `${details.wedding.brideName} & ${details.wedding.groomName}`;
  const monogram = details && [details.wedding.brideName, details.wedding.groomName]
    .map((name) => Array.from(name)[0]).join(" & ");
  const date = details && new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "UTC" })
    .format(new Date(details.wedding.weddingDate + "T00:00:00Z"));

  if (unavailable) return <main className={styles.page}><section className={styles.empty}>
    <h1>This gallery is unavailable</h1><p>Ask the couple for an active gallery link.</p>
  </section></main>;

  return <main className={styles.page}>
    <div className={styles.masthead}>Make My Marriage <span>Guest Gallery</span></div>
    <header className={styles.hero}>
      {monogram && <span className={styles.monogram} aria-hidden="true">{monogram}</span>}
      <h1>{names ?? "Wedding photos"}</h1>
      {date && <p>{date}</p>}
      {details?.guestUploadsEnabled && <button type="button" className={styles.uploadPrimary} onClick={() => setUploadOpen(true)}>Upload photos</button>}
    </header>
    <div className={styles.content}>
      {details && <div className={styles.filters} role="group" aria-label="Filter by event">
        {filters.map(({ id, name }) => <button type="button" key={id} aria-pressed={filter === id} onClick={() => {
          if (filter !== id) { reset(); setFilter(id); }
        }}>{name}</button>)}
      </div>}
      {problem ? <section className={styles.empty} role="alert"><h2>{problem}</h2>
        <button type="button" onClick={() => { reset(); setAttempt((current) => current + 1); }}>Try again</button>
      </section> : !photos || !details ? <p className={styles.empty} role="status">Loading photos…</p>
        : photos.data.length ? <ul className={styles.grid} aria-label="Wedding photos">
          {photos.data.map((photo, index) => <li key={photo.id}>
            <button type="button" className={styles.tile} aria-label={`View photo ${index + 1}`} onClick={() => setActive(index)}>
              <GuestPhoto photo={photo} label="" refresh={() => refreshPhoto(photo.id)} onUnavailable={() => setUnavailable(true)} />
              <span className={styles.eventLabel}>{eventName(photo.eventId)}</span>
            </button>
          </li>)}
        </ul> : <section className={styles.empty}>
          <h2>{filter === "all" ? "No wedding photos yet" : "No photos in this category"}</h2>
          <p>{filter === "all" ? "Check back for photos from the celebration." : "Choose another event or browse all photos."}</p>
          {filter === "all" && details.guestUploadsEnabled && <button type="button" className={styles.uploadPrimary}
            onClick={() => setUploadOpen(true)}>Upload the first photos</button>}
        </section>}
      {!problem && photos?.pagination.nextCursor && <div className={styles.more}>
        {moreProblem && <p role="alert">We couldn’t load more photos.</p>}
        <button type="button" disabled={loadingMore} onClick={() => void loadMore(photos.pagination.nextCursor!)}>
          {loadingMore ? "Loading…" : moreProblem ? "Try again" : "Load more"}
        </button>
        <p>Showing {photos.data.length} of {photos.total} photos</p>
      </div>}
    </div>
    {uploadOpen && details && names && <GuestUpload path={base} names={names} events={details.uploadEvents}
      initialEvent={details.uploadEvents.some(({ id }) => id === filter) ? filter : ""}
      onClose={(refresh) => {
        setUploadOpen(false);
        if (refresh) { reset(); setAttempt((current) => current + 1); }
      }} />}
    {selected && active !== undefined && photos && <Viewer photo={selected} eventName={eventName(selected.eventId)}
      position={active + 1} total={photos.data.length}
      close={() => setActive(undefined)} step={(amount) => {
        if (photos.data[active + amount]) setActive(active + amount);
      }} refresh={() => refreshPhoto(selected.id)} onUnavailable={() => setUnavailable(true)} />}
  </main>;
}
