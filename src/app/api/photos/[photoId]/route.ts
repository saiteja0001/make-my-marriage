import { deletePhoto, getPhoto } from "@/modules/photos/service";
import { photoIdSchema } from "@/modules/photos/validation";
import { authJson } from "@/server/auth/http";
import { photoNotFound, withPhotoAccess } from "../_request";

type Context = { params: Promise<{ photoId: string }> };

export function GET(request: Request, { params }: Context) {
  return withPhotoAccess(request, async ({ weddingId }) => {
    const id = photoIdSchema.safeParse((await params).photoId);
    if (!id.success) return photoNotFound();
    const photo = await getPhoto(weddingId, id.data);
    return photo ? authJson({ data: photo }) : photoNotFound();
  });
}

export function DELETE(request: Request, { params }: Context) {
  return withPhotoAccess(request, async ({ weddingId }) => {
    const id = photoIdSchema.safeParse((await params).photoId);
    if (!id.success) return photoNotFound();
    return await deletePhoto(weddingId, id.data) ? authJson({ data: { success: true } }) : photoNotFound();
  });
}
