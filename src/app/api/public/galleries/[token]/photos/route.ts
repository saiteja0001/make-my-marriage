import { sharedPhotos, sharedWedding } from "@/modules/photos/sharing";
import { photoListSchema } from "@/modules/photos/validation";
import { authJson, validationError } from "@/server/auth/http";
import { galleryServiceError, unavailableGallery } from "../_response";

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
