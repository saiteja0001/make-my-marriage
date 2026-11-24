import { z } from "zod";

export const photoTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const maxPhotoBytes = 10 * 1024 * 1024;
export const maxBatchPhotos = 20;
export const photoIdSchema = z.string().regex(/^[a-f0-9]{24}$/i).toLowerCase();
export const photoExtensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

export const photoUploadSchema = z.strictObject({
  filename: z.string().trim().min(1, "Choose a named photo.").max(200)
    .refine((name) => !Array.from(name).some((character) => character.charCodeAt(0) < 32 || character === "\\" || character === "/"),
      "Use a photo file name without path separators or control characters."),
  mimeType: z.enum(photoTypes, { error: "Choose a JPEG, PNG, or WebP photo." }),
  sizeBytes: z.number().int().min(1, "Choose a photo that contains data.").max(maxPhotoBytes, "Each photo must be 10 MiB or smaller."),
  eventId: photoIdSchema.optional(),
});

export const photoConfirmSchema = photoUploadSchema.extend({
  objectKey: z.string().min(1).max(200),
});

export const photoListSchema = z.strictObject({
  eventId: z.union([photoIdSchema, z.literal("other")]).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(48)).optional().default(24),
  cursor: z.string().regex(/^[a-zA-Z0-9_-]+$/).max(256).optional(),
});

export type PhotoUpload = z.output<typeof photoUploadSchema>;
export type PhotoConfirm = z.output<typeof photoConfirmSchema>;
export type PhotoFilters = z.output<typeof photoListSchema>;
export type PhotoMime = PhotoUpload["mimeType"];
