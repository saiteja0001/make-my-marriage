import { confirmPhoto, listPhotos } from "@/modules/photos/service";
import { photoConfirmSchema, photoListSchema } from "@/modules/photos/validation";
import { authJson, readJson, validationError } from "@/server/auth/http";
import { photoNotFound, withPhotoAccess } from "./_request";

export function GET(request: Request) {
  return withPhotoAccess(request, async ({ weddingId }) => {
    const parsed = photoListSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    return parsed.success ? authJson(await listPhotos(weddingId, parsed.data)) : validationError(parsed.error);
  });
}

export function POST(request: Request) {
  return withPhotoAccess(request, async (scope) => {
    const body = await readJson(request, "photo");
    if (body.error) return body.error;
    const parsed = photoConfirmSchema.safeParse(body.value);
    if (!parsed.success) return validationError(parsed.error);
    const photo = await confirmPhoto(scope, parsed.data);
    return photo ? authJson({ data: photo }) : photoNotFound();
  });
}
