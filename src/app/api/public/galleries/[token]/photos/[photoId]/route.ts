import { sharedPhoto, sharedWedding } from "@/modules/photos/sharing";
import { photoIdSchema } from "@/modules/photos/validation";
import { authJson } from "@/server/auth/http";
import { galleryServiceError, unavailableGallery } from "../../_response";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string; photoId: string }> }) {
  const { token, photoId } = await params;
  try {
    const id = photoIdSchema.safeParse(photoId);
    if (!id.success) return unavailableGallery();
    const wedding = await sharedWedding(token);
    const data = wedding && await sharedPhoto(wedding._id.toString(), id.data);
    return data ? authJson({ data }) : unavailableGallery();
  } catch (error) {
    return galleryServiceError(error);
  }
}
