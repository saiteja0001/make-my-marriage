import { AlreadyHasWedding, createWedding, updateWedding, WeddingDraftChanged } from "@/modules/wedding/service";
import { weddingCreationRequestSchema, weddingUpdateRequestSchema } from "@/modules/wedding/validation";
import { authError, authJson, forbiddenOrigin, readJson, sameOrigin, validationError } from "@/server/auth/http";
import { getSignedInUser } from "@/server/auth/session";

function weddingUnavailable(error: unknown) {
  console.error("Wedding operation failed", error instanceof Error ? error.name : "UnknownError");
  return authError(503, "INTERNAL_ERROR", "Wedding details are temporarily unavailable. Please try again.");
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return forbiddenOrigin();
    const user = await getSignedInUser();
    if (!user) return authError(401, "UNAUTHENTICATED", "Log in to continue.");

    const body = await readJson(request, "wedding");
    if (body.error) return body.error;
    const parsed = weddingCreationRequestSchema.safeParse(body.value);
    if (!parsed.success) return validationError(parsed.error);

    const { draftAccountId, ...input } = parsed.data;
    if (draftAccountId !== undefined && draftAccountId !== user.id) {
      return authError(409, "ACCOUNT_CHANGED", "Sign in to the account that started this wedding draft.");
    }

    const wedding = await createWedding(user.id, input);
    return authJson({ data: wedding }, 201);
  } catch (error) {
    if (error instanceof AlreadyHasWedding) {
      return authError(409, "ALREADY_HAS_WEDDING", "You already belong to a wedding.");
    }
    return weddingUnavailable(error);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!sameOrigin(request)) return forbiddenOrigin();
    const user = await getSignedInUser();
    if (!user) return authError(401, "UNAUTHENTICATED", "Log in to continue.");

    const body = await readJson(request, "wedding");
    if (body.error) return body.error;
    const parsed = weddingUpdateRequestSchema.safeParse(body.value);
    if (!parsed.success) return validationError(parsed.error);

    const { draftAccountId, draftWeddingId, ...changes } = parsed.data;
    if (draftAccountId !== undefined && draftAccountId !== user.id) {
      return authError(409, "ACCOUNT_CHANGED", "Sign in to the account that started these edits.");
    }
    if (Object.keys(changes).length === 0) {
      return authError(400, "VALIDATION_ERROR", "Make at least one change before saving.");
    }

    const wedding = await updateWedding(user.id, changes, draftWeddingId);
    if (!wedding) return authError(404, "NOT_FOUND", "Wedding not found.");
    return authJson({ data: wedding });
  } catch (error) {
    if (error instanceof WeddingDraftChanged) {
      return authError(409, "WEDDING_CHANGED", "Your wedding membership changed while you were editing.");
    }
    return weddingUnavailable(error);
  }
}
