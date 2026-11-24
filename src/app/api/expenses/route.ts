import { z } from "zod";
import { createExpense, listExpenses } from "@/modules/expenses/service";
import { createExpenseSchema, expenseListSchema } from "@/modules/expenses/validation";
import { authError, authJson, readJson, validationError } from "@/server/auth/http";
import { withExpenseAccess } from "./_request";

export function GET(request: Request) {
  return withExpenseAccess(request, async ({ weddingId }) => {
    const query = expenseListSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    return query.success ? authJson(await listExpenses(weddingId, query.data)) : validationError(query.error);
  });
}

export function POST(request: Request) {
  return withExpenseAccess(request, async ({ weddingId, membershipId }) => {
    const key = z.uuid().optional().safeParse(request.headers.get("idempotency-key") ?? undefined);
    if (!key.success) return authError(400, "VALIDATION_ERROR", "Use a valid expense request key.");
    const body = await readJson(request, "expense");
    if (body.error) return body.error;
    const parsed = createExpenseSchema.safeParse(body.value);
    if (!parsed.success) return validationError(parsed.error);
    const { expense, replayed } = await createExpense(weddingId, membershipId, parsed.data, key.data);
    return authJson({ data: expense }, replayed ? 200 : 201);
  });
}
