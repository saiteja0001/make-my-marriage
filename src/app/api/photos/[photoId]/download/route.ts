import { downloadPhoto } from "@/modules/photos/service";
import { photoIdSchema } from "@/modules/photos/validation";
import { authJson } from "@/server/auth/http";
import { photoNotFound, withPhotoAccess } from "../../_request";

export function GET(request: Request, { params }: { params: Promise<{ photoId: string }> }) {
  return withPhotoAccess(request, async ({ weddingId }) => {
    const id = photoIdSchema.safeParse((await params).photoId);
    if (!id.success) return photoNotFound();
    const url = await downloadPhoto(weddingId, id.data);
    return url ? authJson({ data: { url } }) : photoNotFound();
  });
}
