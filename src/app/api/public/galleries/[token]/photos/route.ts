import { sharedPhotos, sharedWedding } from "@/modules/photos/sharing";
import { confirmGuestPhoto } from "@/modules/photos/service";
import { photoConfirmSchema, photoListSchema } from "@/modules/photos/validation";
import { authError, authJson, readJson, validationError } from "@/server/auth/http";
import { galleryServiceError, unavailableGallery, withGuestUpload } from "../_response";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const wedding = await sharedWedding((await params).token);
    if (!wedding) return unavailableGallery();
    const query = photoListSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) return validationError(query.error);
    return authJson(await sharedPhotos(wedding._id.toString(), query.data));
  } catch (error) {
    return galleryServiceError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  return withGuestUpload(request, (await params).token, async (scope) => {
    const body = await readJson(request, "photo");
    if (body.error) return body.error;
    const parsed = photoConfirmSchema.safeParse(body.value);
    if (!parsed.success) return validationError(parsed.error);
    const data = await confirmGuestPhoto(scope, parsed.data);
    return data ? authJson({ data }) : authError(404, "UPLOAD_NOT_FOUND", "This upload couldn’t be found. Choose the photo again.");
  });
}
