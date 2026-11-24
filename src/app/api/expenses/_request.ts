import { expenseDraftContext, ExpenseProblem } from "@/modules/expenses/service";
import { getWeddingForUser } from "@/modules/wedding/service";
import { authError, forbiddenOrigin, sameOrigin } from "@/server/auth/http";
import { getSignedInUser } from "@/server/auth/session";

export function expenseNotFound() {
  return authError(404, "NOT_FOUND", "Expense not found.");
}

export function expenseRevision(request: Request) {
  const header = request.headers.get("if-match");
  if (header === null) return undefined;
  const revision = Number(/^"(0|[1-9][0-9]*)"$/.exec(header)?.[1]);
  if (!Number.isSafeInteger(revision)) throw new ExpenseProblem(400, "VALIDATION_ERROR", "Use a valid expense revision.");
  return revision;
}

export async function withExpenseAccess(request: Request, handle: (scope: { weddingId: string; membershipId: string }) => Promise<Response>) {
  const mutation = request.method !== "GET" && request.method !== "HEAD";
  if (mutation && !sameOrigin(request)) return forbiddenOrigin();
  try {
    const user = await getSignedInUser();
    if (!user) return authError(401, "UNAUTHENTICATED", "Sign in to continue.");
    const current = await getWeddingForUser(user.id);
    const draft = request.headers.get("x-expense-draft");
    if (draft !== null && (!current || draft !== expenseDraftContext(current.wedding.id, current.membershipId))) {
      return authError(409, "DRAFT_CHANGED", "Your account or wedding changed. Reopen Expenses to continue.");
    }
    if (!current) return authError(404, "NOT_FOUND", "Wedding not found.");
    const { wedding: { id: weddingId }, membershipId, membership } = current;
    if (!["ADMIN", "MANAGER"].includes(membership.role)) return authError(403, "FORBIDDEN", "You do not have access to wedding expenses.");
    return await handle({ weddingId, membershipId });
  } catch (error) {
    if (error instanceof ExpenseProblem) return authError(error.status, error.code, error.message, error.details);
    console.error("Expense operation failed", error instanceof Error ? error.name : "UnknownError");
    return authError(503, "EXPENSES_UNAVAILABLE", "Expenses are temporarily unavailable. Try again.");
  }
}
