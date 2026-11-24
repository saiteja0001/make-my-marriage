"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { rsvpUpdatesChannel } from "@/modules/guests/rsvp-updates";

export function RsvpRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(rsvpUpdatesChannel);
    window.addEventListener("focus", refresh);
    channel?.addEventListener("message", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      channel?.close();
    };
  }, [router]);
  return null;
}
