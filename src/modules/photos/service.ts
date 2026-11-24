import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { ClientSession, QueryFilter } from "mongoose";
import { z } from "zod";
import { fixedWindowRetryAfter } from "@/modules/auth/rate-limit";
import { WeddingEvent } from "@/modules/events/model";
import { lockActiveEventReferences } from "@/modules/events/service";
import { Wedding } from "@/modules/wedding/models";
import { connectDatabase } from "@/server/db/mongoose";
import {
  copyVerifiedObject, inspectObject, R2ObjectChanged, R2ObjectMissing, readObjectPrefix, removeObject, signRead, signUpload,
} from "@/server/storage/r2";
import { preparePhotoStorage, WeddingPhoto, type PhotoRecord } from "./model";
import { photoExtensions, photoIdSchema, type PhotoConfirm, type PhotoFilters, type PhotoMime, type PhotoUpload } from "./validation";

const minute = 60_000;
const confirmationGrace = 24 * 60 * minute;
const cursorSchema = z.tuple([z.iso.datetime(), photoIdSchema, z.string().nullable()]);
export type PhotoScope = { weddingId: string; membershipId: string };
export type GuestPhotoScope = { weddingId: string; galleryHash: string; client: string | null; guestUploadsEnabled: boolean };
type UploadScope = PhotoScope | GuestPhotoScope;

export class PhotoProblem extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?: number) {
    super(message);
  }
}

export function photoDraftContext({ weddingId, membershipId }: PhotoScope) {
  return createHash("sha256").update(JSON.stringify([weddingId, membershipId])).digest("hex");
}

function unavailableEvent() {
  return new PhotoProblem(404, "EVENT_UNAVAILABLE", "Choose an active event from your wedding.");
}

function guestUploadsPaused() {
  return new PhotoProblem(409, "UPLOADS_PAUSED", "Guest uploads are paused. You can still view the gallery.");
}

async function lockGuestUploads(scope: GuestPhotoScope, session: ClientSession) {
  const result = await Wedding.updateOne({
    _id: scope.weddingId, "gallery.tokenHash": scope.galleryHash,
    "gallery.isEnabled": true, "gallery.guestUploadsEnabled": true,
  }, { $inc: { "gallery.uploadRevision": 1 } }, { session, timestamps: false });
  if (!result.matchedCount) throw guestUploadsPaused();
}

function uploader(scope: UploadScope) {
  return "galleryHash" in scope ? { uploaderType: "GUEST" as const }
    : { uploadedByMembershipId: scope.membershipId };
}

async function limitGuestUpload(scope: GuestPhotoScope, action: "reserve" | "confirm") {
  const key = "guest-photo-" + action;
  const perClient = action === "reserve" ? 60 : 120;
  const retryAfter = (scope.client && await fixedWindowRetryAfter([key, "client", scope.client], perClient, 15 * minute))
    || await fixedWindowRetryAfter([key, "gallery", scope.weddingId], perClient * 5, 15 * minute);
  if (retryAfter !== null) throw new PhotoProblem(429, "RATE_LIMITED", "Upload limit reached. Wait before trying again.", retryAfter);
}

export async function reservePhoto(scope: UploadScope, input: PhotoUpload) {
  if ("galleryHash" in scope && !scope.guestUploadsEnabled) throw guestUploadsPaused();
  const database = await connectDatabase();
  const { weddingId } = scope;
  const { eventId, filename, mimeType, sizeBytes } = input;
  if (eventId && !await WeddingEvent.exists({ _id: eventId, weddingId, archivedAt: null })) throw unavailableEvent();
  if ("galleryHash" in scope) await limitGuestUpload(scope, "reserve");
  else {
    const retryAfter = await fixedWindowRetryAfter(["photo-upload", "member", scope.membershipId], 120, 15 * minute)
      ?? await fixedWindowRetryAfter(["photo-upload", "wedding", weddingId], 600, 15 * minute);
    if (retryAfter !== null) throw new PhotoProblem(429, "RATE_LIMITED", "Upload limit reached. Wait before trying again.", retryAfter);
  }

  await preparePhotoStorage();
  const objectKey = `weddings/${weddingId}/gallery/staging/${randomUUID()}.${photoExtensions[mimeType]}`;
  const expiresAt = new Date(Date.now() + 10 * minute);
  const uploadUrl = await signUpload(objectKey, mimeType, sizeBytes, expiresAt);
  await database.transaction(async (session) => {
    if ("galleryHash" in scope) await lockGuestUploads(scope, session);
    if (eventId && !await lockActiveEventReferences(weddingId, [eventId], session)) throw unavailableEvent();
    await new WeddingPhoto({
      weddingId, ...uploader(scope), originalFilename: filename, mimeType, sizeBytes, eventId,
      uploadKey: objectKey, objectKey, status: "PENDING", expiresAt,
    }).save({ session });
  });
  return { uploadUrl, objectKey, expiresAt: expiresAt.toISOString() };
}

function formatMatches(bytes: Uint8Array, mime: PhotoMime) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  const text = Buffer.from(bytes).toString("ascii");
  return text.startsWith("RIFF") && text.slice(8, 12) === "WEBP";
}

function invalidUpload() {
  return new PhotoProblem(400, "INVALID_PHOTO", "The uploaded file does not match the selected photo type or size.");
}

async function signedPhoto(photo: PhotoRecord) {
  const urlExpiresAt = new Date(Date.now() + 15 * minute).toISOString();
  return {
    id: photo._id.toString(), eventId: photo.eventId?.toString() ?? null, originalFilename: photo.originalFilename,
    mimeType: photo.mimeType, sizeBytes: photo.sizeBytes, uploaderType: photo.uploaderType, createdAt: photo.createdAt.toISOString(),
    url: await signRead(photo.objectKey), urlExpiresAt,
  };
}

export type GalleryPhoto = Awaited<ReturnType<typeof signedPhoto>>;

async function removeUnusedObject(key: string) {
  // An unavailable store leaves an orphan for reconciliation without affecting the published photo.
  await removeObject(key).catch(() => {});
}

export async function confirmPhoto(scope: PhotoScope, input: PhotoConfirm) {
  const photo = await publishPhoto(scope, input);
  return photo ? signedPhoto(photo) : null;
}

export async function confirmGuestPhoto(scope: GuestPhotoScope, input: PhotoConfirm) {
  await limitGuestUpload(scope, "confirm");
  const photo = await publishPhoto(scope, input);
  return photo ? { id: photo._id.toString() } : null;
}

async function publishPhoto(access: UploadScope, input: PhotoConfirm) {
  const database = await connectDatabase();
  const { weddingId } = access;
  const scope = { weddingId, ...uploader(access), uploadKey: input.objectKey };
  const pending = await WeddingPhoto.findOne(scope).lean();
  if ("galleryHash" in access && !access.guestUploadsEnabled && pending?.status !== "READY") throw guestUploadsPaused();
  if (!pending) return null;
  if (pending.originalFilename !== input.filename || pending.mimeType !== input.mimeType
    || pending.sizeBytes !== input.sizeBytes || pending.eventId?.toString() !== input.eventId) throw invalidUpload();
  const gone = new PhotoProblem(410, "UPLOAD_GONE", "This photo was deleted or its upload expired. Start a new upload.");
  if (pending.status === "DELETED") throw gone;
  if (pending.status === "READY") return pending;
  if (Date.now() > pending.expiresAt.getTime() + confirmationGrace) throw gone;

  const finalKey = `weddings/${weddingId}/gallery/${randomUUID()}.${photoExtensions[pending.mimeType]}`;
  try {
    const staged = await inspectObject(pending.uploadKey);
    if (staged.size !== pending.sizeBytes || staged.contentType !== pending.mimeType || !staged.etag) throw invalidUpload();
    if (!formatMatches(await readObjectPrefix(pending.uploadKey, staged.etag), pending.mimeType)) throw invalidUpload();
    await copyVerifiedObject(pending.uploadKey, finalKey, staged.etag, pending.mimeType);
  } catch (error) {
    if (error instanceof R2ObjectMissing || error instanceof R2ObjectChanged) {
      const current = await WeddingPhoto.findOne(scope).lean();
      if (current?.status === "READY") return current;
      if (current?.status === "DELETED") throw gone;
      throw new PhotoProblem(409, "UPLOAD_INCOMPLETE", "The photo could not be verified. Try the upload again.");
    }
    throw error;
  }

  const publish = (session?: ClientSession) => WeddingPhoto.findOneAndUpdate({ ...scope, status: "PENDING" },
    { $set: { objectKey: finalKey, status: "READY" } }, { returnDocument: "after", session }).lean();
  const published = await ("galleryHash" in access ? database.transaction(async (session) => {
    await lockGuestUploads(access, session);
    // Check the event only when this transaction is publishing the photo.
    const photo = await publish(session);
    if (photo && input.eventId && !await lockActiveEventReferences(weddingId, [input.eventId], session)) throw unavailableEvent();
    return photo;
  }) : publish()).catch(async (error: unknown) => {
    // A committed row may reference the copy after an ambiguous database error.
    if (error instanceof PhotoProblem) await removeUnusedObject(finalKey);
    throw error;
  });
  if (published) {
    await removeUnusedObject(pending.uploadKey);
    return published;
  }

  await removeUnusedObject(finalKey);
  const winner = await WeddingPhoto.findOne(scope).lean();
  if (winner?.status === "READY") return winner;
  throw gone;
}

function decodeCursor(value: string, event: string | null) {
  const invalid = new PhotoProblem(400, "INVALID_CURSOR", "Reload the gallery to continue browsing.");
  try {
    const [createdAt, id, filter] = cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    if (filter === event) return { createdAt: new Date(createdAt), id };
  } catch {
    throw invalid;
  }
  throw invalid;
}

export async function listPhotos(weddingId: string, query: PhotoFilters) {
  return photoPage(weddingId, query, signedPhoto);
}

export async function photoPage<T>(weddingId: string, query: PhotoFilters, project: (photo: PhotoRecord) => Promise<T>) {
  await connectDatabase();
  const filter: QueryFilter<PhotoRecord> = { weddingId, status: "READY" };
  if (query.eventId) filter.eventId = query.eventId === "other" ? null : query.eventId;
  const previous = query.cursor && decodeCursor(query.cursor, query.eventId ?? null);
  const window = previous ? { ...filter, $or: [
    { createdAt: { $lt: previous.createdAt } },
    { createdAt: previous.createdAt, _id: { $lt: previous.id } },
  ] } : filter;
  const [found, total] = await Promise.all([
    WeddingPhoto.find(window).sort({ createdAt: -1, _id: -1 }).limit(query.limit + 1).lean(),
    WeddingPhoto.countDocuments(filter),
  ]);
  const page = found.slice(0, query.limit);
  const last = page.at(-1);
  const nextCursor = found.length > query.limit && last
    ? Buffer.from(JSON.stringify([last.createdAt.toISOString(), last._id.toString(), query.eventId ?? null])).toString("base64url")
    : null;
  return { data: await Promise.all(page.map(project)), pagination: { nextCursor }, total };
}

export async function readyPhoto(weddingId: string, photoId: string) {
  await connectDatabase();
  return WeddingPhoto.findOne({ weddingId, _id: photoId, status: "READY" }).lean();
}

export async function getPhoto(weddingId: string, photoId: string) {
  const photo = await readyPhoto(weddingId, photoId);
  return photo ? signedPhoto(photo) : null;
}

export async function downloadPhoto(weddingId: string, photoId: string) {
  const photo = await readyPhoto(weddingId, photoId);
  if (!photo) return null;
  const fallback = `photo.${photoExtensions[photo.mimeType]}`;
  const filename = encodeURIComponent(photo.originalFilename.toWellFormed())
    .replace(/['()*]/g, (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase());
  return signRead(photo.objectKey, `attachment; filename="${fallback}"; filename*=UTF-8''${filename}`);
}

export async function deletePhoto(weddingId: string, photoId: string) {
  await connectDatabase();
  const scope = { weddingId, _id: photoId };
  const photo = await WeddingPhoto.findOne(scope).lean();
  if (!photo || photo.status === "PENDING") return false;
  if (photo.status === "DELETED") return true;
  await removeObject(photo.objectKey);
  await WeddingPhoto.updateOne({ ...scope, status: "READY" }, { $set: { status: "DELETED" } });
  return true;
}
