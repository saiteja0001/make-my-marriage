import Image from "next/image";
import type { DiscoveryMode, DiscoveryPlace } from "@/modules/vendors/discovery-validation";
import styles from "./place-summary.module.css";

export function PlaceSummary({ place, mode }: { place: DiscoveryPlace; mode: Exclude<DiscoveryMode, "disabled"> }) {
  return <div className={styles.summary}>
    <div className={styles.heading}>
      <strong>{place.name}</strong>
      {place.rating !== undefined && <span className={styles.rating} aria-label={`Rated ${place.rating} out of 5`}>★ {place.rating.toFixed(1)}</span>}
    </div>
    {place.address && <p>{place.address}</p>}
    {place.mapsUrl && <a href={place.mapsUrl} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>}
    <div className={styles.attribution}>
      {mode === "google" ? <Image src="/google-maps-attribution.png" width={98} height={18} alt="Google Maps" unoptimized />
        : <span>Sample listing</span>}
      {place.attributions.map(({ name, url }, index) => url
        ? <a key={index} href={url} target="_blank" rel="noopener noreferrer">{name}</a>
        : <span key={index}>{name}</span>)}
    </div>
  </div>;
}
