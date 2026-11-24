"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import workspaceStyles from "../../workspace.module.css";
import styles from "./gallery.module.css";
import qrStyles from "./gallery-qr.module.css";

function VenueSign({ coupleNames, image }: { coupleNames: string; image: string }) {
  return <article className={qrStyles.sign}>
    <p className={qrStyles.signTitle}>Capture &amp; share our joy</p>
    <p className={qrStyles.names}>{coupleNames}</p>
    <Image src={image} width={1024} height={1024} alt="QR code for the wedding gallery" unoptimized loading="eager" />
    <p className={qrStyles.signInstruction}>Scan to open our wedding gallery</p>
  </article>;
}

function PrintPreview({ coupleNames, image, onClose }: { coupleNames: string; image: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const panel = dialog.current;
    if (!panel?.open) panel?.showModal();
    return () => panel?.close();
  }, []);

  function close() {
    dialog.current?.close();
    onClose();
  }

  return createPortal(
    <div className={`${workspaceStyles.workspace} ${qrStyles.printRoot}`}>
      <dialog ref={dialog} className={qrStyles.printPreview} aria-labelledby="gallery-print-title"
        onCancel={(event) => { event.preventDefault(); event.stopPropagation(); close(); }}>
        <header className={qrStyles.printHeader}>
          <div>
            <h2 id="gallery-print-title">Print venue sign</h2>
            <p>A4 portrait</p>
          </div>
          <div className={styles.headingActions}>
            <button type="button" className={styles.secondary} onClick={close}>Back to sharing</button>
            <button type="button" className={styles.primary} onClick={() => window.print()}>Print</button>
          </div>
        </header>
        <div className={qrStyles.previewPaper}><VenueSign coupleNames={coupleNames} image={image} /></div>
      </dialog>
      <div className={qrStyles.printPaper} aria-hidden="true">
        <VenueSign coupleNames={coupleNames} image={image} />
      </div>
    </div>,
    document.body,
  );
}

export function GalleryQr({ url, coupleNames, uploadsEnabled, pending }: {
  url: string | null; coupleNames: string; uploadsEnabled: boolean; pending: boolean;
}) {
  const [image, setImage] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const [preview, setPreview] = useState(false);
  const host = url ? new URL(url).hostname : "";
  const localOnly = host === "localhost" || host.endsWith(".localhost") || /^127(?:\.\d{1,3}){3}$/.test(host) || host === "[::1]";

  useEffect(() => {
    if (!url) return;
    let current = true;
    void import("qrcode").then(({ toDataURL }) => toDataURL(url, {
      errorCorrectionLevel: "M", margin: 4, width: 1024, color: { dark: "#000000", light: "#ffffff" },
    })).then((data) => { if (current) setImage(data); })
      .catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [url, attempt]);

  function download() {
    const anchor = document.createElement("a");
    anchor.href = image;
    anchor.download = "wedding-gallery-qr.png";
    anchor.click();
    setDownloaded(true);
  }

  return <section className={qrStyles.card} aria-labelledby="gallery-qr-title">
    <h3 id="gallery-qr-title">Gallery QR code</h3>
    {!url ? <p>Turn on guest viewing to use the QR code. Previously printed codes work again when viewing is back on.</p>
      : <>
        <div className={qrStyles.code}>
          {image ? <Image src={image} width={148} height={148} alt="QR code for the wedding gallery" unoptimized loading="eager" />
            : failed ? <div role="alert">
              <p>The QR code couldn’t be created.</p>
              <button type="button" className={styles.secondary} onClick={() => { setFailed(false); setAttempt((n) => n + 1); }}>Try again</button>
            </div> : <p role="status">Creating QR code…</p>}
        </div>
        <p>{uploadsEnabled ? "Guests can scan to view and add wedding photos." : "Guests can scan to view wedding photos."}</p>
        {localOnly && <p className={qrStyles.localNote}>This link points to this computer. Use an app address guests can reach before printing for the venue.</p>}
        <div className={styles.headingActions}>
          <button type="button" className={styles.secondary} disabled={pending || !image} onClick={download}>Download QR</button>
          <button type="button" className={styles.primary} disabled={pending || !image} onClick={() => setPreview(true)}>Print sign</button>
        </div>
        {downloaded && <p role="status">QR download started.</p>}
        {preview && <PrintPreview coupleNames={coupleNames} image={image} onClose={() => setPreview(false)} />}
      </>}
  </section>;
}
