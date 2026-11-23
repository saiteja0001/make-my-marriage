import "server-only";
import { MemberError, memberProblems } from "@/modules/wedding/member-errors";
import { authError } from "@/server/auth/http";

export function memberErrorResponse(error: unknown) {
  if (error instanceof MemberError) {
    const problem = memberProblems[error.code];
    return authError(problem.status, error.code, problem.message);
  }
  console.error("Wedding member operation failed", error instanceof Error ? error.name : "UnknownError");
  return authError(503, "INTERNAL_ERROR", "Wedding member access is temporarily unavailable. Please try again.");
}
