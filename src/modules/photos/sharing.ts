import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { WeddingEvent } from "@/modules/events/model";
import { connectWeddingStorage, Wedding } from "@/modules/wedding/models";
import { signRead } from "@/server/storage/r2";
import { WeddingPhoto, type PhotoRecord } from "./model";
import { photoPage, readyPhoto } from "./service";
import type { PhotoFilters } from "./validation";

export type GallerySettings = { isEnabled: boolean; galleryUrl: string | null };
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

function key() {
  const configured = process.env.GALLERY_TOKEN_KEY?.trim() ?? "";
  if (!/^[a-f0-9]{64}$/i.test(configured)) throw new Error("Gallery encryption key is missing.");
  return Buffer.from(configured, "hex");
}

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function encrypt(token: string, weddingId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(weddingId));
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

function decrypt(value: string, weddingId: string) {
  const bytes = Buffer.from(value, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  decipher.setAAD(Buffer.from(weddingId));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
}

function settingsOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) throw new Error("Gallery public origin is missing.");
  const { protocol, origin } = new URL(configured);
  if (protocol !== "https:" && protocol !== "http:") throw new Error("Gallery public origin is invalid.");
  return origin;
}

export async function gallerySettings(weddingId: string): Promise<GallerySettings> {
  await connectWeddingStorage();
  const wedding = await Wedding.findById(weddingId).select("+gallery").lean();
  if (!wedding?.gallery?.isEnabled) return { isEnabled: false, galleryUrl: null };
  const token = decrypt(wedding.gallery.encryptedToken, weddingId);
  return { isEnabled: true, galleryUrl: new URL(`/gallery/${token}`, settingsOrigin()).href };
}

export async function setGallerySharing(weddingId: string, isEnabled: boolean) {
  await connectWeddingStorage();
  if (isEnabled) {
    settingsOrigin();
    const existing = await Wedding.findById(weddingId).select("+gallery").lean();
    if (existing?.gallery) {
      decrypt(existing.gallery.encryptedToken, weddingId);
    } else {
      const token = randomBytes(32).toString("base64url");
      await Wedding.updateOne({ _id: weddingId, gallery: { $exists: false } }, {
        $set: { gallery: { tokenHash: hash(token), encryptedToken: encrypt(token, weddingId), isEnabled: false } },
      });
    }
  }
  await Wedding.updateOne({ _id: weddingId, "gallery.tokenHash": { $exists: true } }, {
    $set: { "gallery.isEnabled": isEnabled },
  });
  return gallerySettings(weddingId);
}

export async function sharedWedding(token: string) {
  if (!tokenPattern.test(token)) return null;
  await connectWeddingStorage();
  return Wedding.findOne({ "gallery.tokenHash": hash(token), "gallery.isEnabled": true })
    .select("brideName groomName weddingDate").lean();
}

export async function sharedGallery(token: string) {
  const wedding = await sharedWedding(token);
  if (!wedding) return null;
  const { brideName, groomName, weddingDate } = wedding;
  const weddingId = wedding._id;
  const eventIds = await WeddingPhoto.distinct("eventId", { weddingId, status: "READY", eventId: { $ne: null } });
  const events = eventIds.length
    ? (await WeddingEvent.find({ weddingId, _id: { $in: eventIds } })
      .select("name").sort({ startsAt: 1, _id: 1 }).lean())
      .map(({ _id, name }) => ({ id: _id.toString(), name }))
    : [];
  return { wedding: { brideName, groomName, weddingDate }, events, guestUploadsEnabled: false };
}

async function sharedPhotoFields({ _id, objectKey, eventId }: PhotoRecord) {
  return { id: _id.toString(), eventId: eventId?.toString() ?? null, url: await signRead(objectKey, undefined, 120) };
}

export type SharedPhoto = Awaited<ReturnType<typeof sharedPhotoFields>>;

export function sharedPhotos(weddingId: string, filters: PhotoFilters) {
  return photoPage(weddingId, filters, sharedPhotoFields);
}

export async function sharedPhoto(weddingId: string, id: string) {
  const photo = await readyPhoto(weddingId, id);
  return photo ? sharedPhotoFields(photo) : null;
}
