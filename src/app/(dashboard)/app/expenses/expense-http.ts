import type { expenseSummary, listExpenses } from "@/modules/expenses/service";
import type { vendorOptions } from "@/modules/vendors/service";

export type ExpenseEvent = { id: string; name: string; archived: boolean };
export type ExpenseVendor = Awaited<ReturnType<typeof vendorOptions>>[number];
export type ExpensePage = Awaited<ReturnType<typeof listExpenses>>;
export type ExpenseSummary = Awaited<ReturnType<typeof expenseSummary>>;

export class ExpenseRequestError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, string>) {
    super(message);
  }
}

export async function expenseRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) {
    throw new ExpenseRequestError(response.status, body?.error?.code ?? "",
      body?.error?.message ?? "Expenses couldn’t load. Try again.", body?.error?.details);
  }
  return body;
}
