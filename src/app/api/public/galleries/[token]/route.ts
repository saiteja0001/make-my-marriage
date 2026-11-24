import { sharedGallery } from "@/modules/photos/sharing";
import { authJson } from "@/server/auth/http";
import { galleryServiceError, unavailableGallery } from "./_response";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const data = await sharedGallery((await params).token);
    return data ? authJson({ data }) : unavailableGallery();
  } catch (error) {
    return galleryServiceError(error);
  }
}
