import { reservePhoto } from "@/modules/photos/service";
import { photoUploadSchema } from "@/modules/photos/validation";
import { authJson, readJson, validationError } from "@/server/auth/http";
import { withPhotoAccess } from "../_request";

export function POST(request: Request) {
  return withPhotoAccess(request, async (scope) => {
    const body = await readJson(request, "photo");
    if (body.error) return body.error;
    const parsed = photoUploadSchema.safeParse(body.value);
    return parsed.success ? authJson({ data: await reservePhoto(scope, parsed.data) }, 201) : validationError(parsed.error);
  });
}
