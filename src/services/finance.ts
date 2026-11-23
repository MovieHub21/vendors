import { call } from "./api";
import type { BusinessExpense, ExpenseCategory, ProfitLossReport, ReportPeriod } from "../lib/finance";

export const getProfitLossReport = (period: ReportPeriod) =>
  call<{ report: ProfitLossReport }>("profit-loss", { period });

export const listExpenses = () => call<{ expenses: BusinessExpense[] }>("expenses", { action: "list" });

export const saveExpense = (input: {
  id?: string;
  amount_kobo: number;
  category: ExpenseCategory;
  description: string;
  incurred_on: string;
}) => call<{ expense: BusinessExpense }>("expenses", { action: "save", ...input });

export const deleteExpense = (id: string) => call<{ deleted: boolean }>("expenses", { action: "delete", id });
