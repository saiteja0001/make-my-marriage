"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function DashboardHistoryRefresh() {
  const router = useRouter();

  useEffect(() => {
    let refreshTimer: number | undefined;
    function refreshRestoredDashboard(event: PageTransitionEvent) {
      if (!event.persisted) return;
      // Let Next.js restore its history state before requesting fresh totals.
      refreshTimer = window.setTimeout(() => router.refresh(), 0);
    }

    window.addEventListener("pageshow", refreshRestoredDashboard);
    return () => {
      window.removeEventListener("pageshow", refreshRestoredDashboard);
      window.clearTimeout(refreshTimer);
    };
  }, [router]);

  return null;
}
