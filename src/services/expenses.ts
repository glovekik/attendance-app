import { apiCall } from "./http";
import { Expense, ExpenseSummary } from "../types";

export interface ExpensePayload {
  title: string;
  amount: number;
  category: string;
  date: string;
  description?: string;
  receiptUrl?: string;
  vendor?: string;
  paymentMethod?: string;
}

export type ExpenseSortColumn =
  | "date"
  | "amount"
  | "category"
  | "title"
  | "vendor";

interface ListFilters {
  from?: string;
  to?: string;
  category?: string;
  search?: string;
  sort?: ExpenseSortColumn;
  order?: "asc" | "desc";
}

const buildQs = (f?: ListFilters) => {
  if (!f) return "";
  const parts: string[] = [];
  if (f.from) parts.push(`from=${f.from}`);
  if (f.to) parts.push(`to=${f.to}`);
  if (f.category)
    parts.push(`category=${encodeURIComponent(f.category)}`);
  if (f.search)
    parts.push(`search=${encodeURIComponent(f.search)}`);
  if (f.sort) parts.push(`sort=${f.sort}`);
  if (f.order) parts.push(`order=${f.order}`);
  return parts.length ? `?${parts.join("&")}` : "";
};

export const hrCreateExpense = (
  token: string,
  data: ExpensePayload
) =>
  apiCall<Expense>("/hr/expenses", {
    method: "POST",
    body: data,
    token,
  });

export const hrListExpenses = (
  token: string,
  filters?: ListFilters
) =>
  apiCall<Expense[]>(`/hr/expenses${buildQs(filters)}`, {
    token,
  });

export const hrExpenseSummary = (
  token: string,
  year: number,
  month: number
) =>
  apiCall<ExpenseSummary>(
    `/hr/expenses/summary?year=${year}&month=${month}`,
    { token }
  );

export const hrUpdateExpense = (
  token: string,
  id: string,
  data: Partial<ExpensePayload>
) =>
  apiCall<Expense>(`/hr/expenses/${id}`, {
    method: "PUT",
    body: data,
    token,
  });

export const hrDeleteExpense = (token: string, id: string) =>
  apiCall<{ message: string }>(`/hr/expenses/${id}`, {
    method: "DELETE",
    token,
  });
