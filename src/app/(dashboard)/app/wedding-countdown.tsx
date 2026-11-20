"use client";

import { useSyncExternalStore } from "react";
import { daysUntilWedding } from "@/modules/wedding/wedding-date";
import styles from "../workspace.module.css";

function subscribe(refresh: () => void) {
  const interval = window.setInterval(refresh, 30_000);
  document.addEventListener("visibilitychange", refresh);
  return () => {
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", refresh);
  };
}

export function WeddingCountdown({ weddingDate, timeZone, initialDays }: {
  weddingDate: string;
  timeZone: string;
  initialDays: number;
}) {
  const days = useSyncExternalStore(
    subscribe,
    () => daysUntilWedding(weddingDate, timeZone),
    () => initialDays,
  );

  return (
    <p className={styles.countdown} aria-live="polite">
      {days > 0 ? <><strong>{days}</strong> {days === 1 ? "day to go" : "days to go"}</>
        : days === 0 ? "Wedding day is today" : "Wedding day has passed"}
    </p>
  );
}
