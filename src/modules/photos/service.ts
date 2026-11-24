import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { QueryFilter } from "mongoose";
import { z } from "zod";
import { fixedWindowRetryAfter } from "@/modules/auth/rate-limit";
import { WeddingEvent } from "@/modules/events/model";
import { lockActiveEventReferences } from "@/modules/events/service";
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

export async function reservePhoto(scope: PhotoScope, input: PhotoUpload) {
  const database = await connectDatabase();
  const { weddingId, membershipId } = scope;
  const { eventId, filename, mimeType, sizeBytes } = input;
  if (eventId && !await WeddingEvent.exists({ _id: eventId, weddingId, archivedAt: null })) throw unavailableEvent();
  const retryAfter = await fixedWindowRetryAfter(["photo-upload", "member", membershipId], 120, 15 * minute)
    ?? await fixedWindowRetryAfter(["photo-upload", "wedding", weddingId], 600, 15 * minute);
  if (retryAfter !== null) throw new PhotoProblem(429, "RATE_LIMITED", "Upload limit reached. Wait before trying again.", retryAfter);

  await preparePhotoStorage();
  const objectKey = `weddings/${weddingId}/gallery/staging/${randomUUID()}.${photoExtensions[mimeType]}`;
  const expiresAt = new Date(Date.now() + 10 * minute);
  const uploadUrl = await signUpload(objectKey, mimeType, sizeBytes, expiresAt);
  await database.transaction(async (session) => {
    if (eventId && !await lockActiveEventReferences(weddingId, [eventId], session)) throw unavailableEvent();
    await new WeddingPhoto({
      weddingId, uploadedByMembershipId: membershipId, originalFilename: filename, mimeType, sizeBytes, eventId,
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

export async function confirmPhoto({ weddingId, membershipId }: PhotoScope, input: PhotoConfirm) {
  await connectDatabase();
  const scope = { weddingId, uploadedByMembershipId: membershipId, uploadKey: input.objectKey };
  const pending = await WeddingPhoto.findOne(scope).lean();
  if (!pending) return null;
  if (pending.originalFilename !== input.filename || pending.mimeType !== input.mimeType
    || pending.sizeBytes !== input.sizeBytes || pending.eventId?.toString() !== input.eventId) throw invalidUpload();
  const gone = new PhotoProblem(410, "UPLOAD_GONE", "This photo was deleted or its upload expired. Start a new upload.");
  if (pending.status === "DELETED") throw gone;
  if (pending.status === "READY") return signedPhoto(pending);
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
      if (current?.status === "READY") return signedPhoto(current);
      if (current?.status === "DELETED") throw gone;
      throw new PhotoProblem(409, "UPLOAD_INCOMPLETE", "The photo could not be verified. Try the upload again.");
    }
    throw error;
  }

  // Leave a verified copy in place after an ambiguous database failure. A committed row may already reference it.
  const published = await WeddingPhoto.findOneAndUpdate({ ...scope, status: "PENDING" },
    { $set: { objectKey: finalKey, status: "READY" } }, { returnDocument: "after" }).lean();
  if (published) {
    await removeUnusedObject(pending.uploadKey);
    return signedPhoto(published);
  }

  await removeUnusedObject(finalKey);
  const winner = await WeddingPhoto.findOne(scope).lean();
  if (winner?.status === "READY") return signedPhoto(winner);
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
  return { data: await Promise.all(page.map(signedPhoto)), pagination: { nextCursor }, total };
}

async function readyPhoto(weddingId: string, photoId: string) {
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
