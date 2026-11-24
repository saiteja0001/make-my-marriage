import { z } from "zod";
import { withPhotoAccess } from "@/app/api/photos/_request";
import { gallerySettings, setGallerySharing } from "@/modules/photos/sharing";
import { authJson, readJson, validationError } from "@/server/auth/http";

const sharingSchema = z.strictObject({ isEnabled: z.boolean() });

export function GET(request: Request) {
  return withPhotoAccess(request, async ({ weddingId }) => authJson({ data: await gallerySettings(weddingId) }));
}

export function PATCH(request: Request) {
  return withPhotoAccess(request, async ({ weddingId }) => {
    const body = await readJson(request, "gallery");
    if (body.error) return body.error;
    const parsed = sharingSchema.safeParse(body.value);
    return parsed.success
      ? authJson({ data: await setGallerySharing(weddingId, parsed.data.isEnabled) })
      : validationError(parsed.error);
  });
}
