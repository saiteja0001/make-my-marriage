import type { Metadata } from "next";
import { GuestGallery } from "./guest-gallery";

export const metadata: Metadata = {
  title: "Wedding Gallery",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function GuestGalleryPage({ params }: { params: Promise<{ token: string }> }) {
  return <GuestGallery token={(await params).token} />;
}
