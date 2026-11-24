import { deleteExpense, getExpense, updateExpense } from "@/modules/expenses/service";
import { expenseIdSchema, updateExpenseSchema } from "@/modules/expenses/validation";
import { authJson, readJson, validationError } from "@/server/auth/http";
import { expenseNotFound, expenseRevision, withExpenseAccess } from "../_request";

type Params = { params: Promise<{ expenseId: string }> };

export function GET(request: Request, { params }: Params) {
  return withExpenseAccess(request, async ({ weddingId }) => {
    const id = expenseIdSchema.safeParse((await params).expenseId);
    const data = id.success && await getExpense(weddingId, id.data);
    return data ? authJson({ data }) : expenseNotFound();
  });
}

export function PATCH(request: Request, { params }: Params) {
  return withExpenseAccess(request, async ({ weddingId }) => {
    const id = expenseIdSchema.safeParse((await params).expenseId);
    if (!id.success) return expenseNotFound();
    const revision = expenseRevision(request);
    const body = await readJson(request, "expense");
    if (body.error) return body.error;
    const parsed = updateExpenseSchema.safeParse(body.value);
    if (!parsed.success) return validationError(parsed.error);
    const data = await updateExpense(weddingId, id.data, parsed.data, revision);
    return data ? authJson({ data }) : expenseNotFound();
  });
}

export function DELETE(request: Request, { params }: Params) {
  return withExpenseAccess(request, async ({ weddingId }) => {
    const id = expenseIdSchema.safeParse((await params).expenseId);
    const removed = id.success && await deleteExpense(weddingId, id.data, expenseRevision(request));
    return removed ? authJson({ data: { success: true } }) : expenseNotFound();
  });
}
