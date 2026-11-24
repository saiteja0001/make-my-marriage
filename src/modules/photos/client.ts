import type { GalleryPhoto } from "@/modules/photos/service";

export type GalleryEvent = { id: string; name: string; archived: boolean };
export type GalleryResult = { data: GalleryPhoto[]; pagination: { nextCursor: string | null }; total: number };

export class GalleryRequestError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function galleryRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new GalleryRequestError(response.status, data?.error?.code ?? "", data?.error?.message || "Something went wrong. Try again.");
  }
  return data;
}

export function photoSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}
