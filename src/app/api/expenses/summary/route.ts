import { expenseSummary } from "@/modules/expenses/service";
import { authJson } from "@/server/auth/http";
import { withExpenseAccess } from "../_request";

export function GET(request: Request) {
  return withExpenseAccess(request, async ({ weddingId }) => authJson({ data: await expenseSummary(weddingId) }));
}
