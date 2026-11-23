export type ReportPeriod = "today" | "month" | "all_time";

export const REPORT_PERIODS: ReadonlyArray<{ id: ReportPeriod; label: string }> = [
  { id: "today", label: "Today" },
  { id: "month", label: "This month" },
  { id: "all_time", label: "All time" },
];

export const EXPENSE_CATEGORIES = [
  ["rent", "Rent"],
  ["utilities", "Utilities"],
  ["transport", "Transport"],
  ["packaging", "Packaging"],
  ["delivery", "Delivery"],
  ["marketing", "Marketing"],
  ["wages", "Wages"],
  ["fees", "Transaction fees"],
  ["other", "Other"],
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number][0];

export interface BusinessExpense {
  id: string;
  amount_kobo: number;
  category: ExpenseCategory;
  description: string;
  incurred_on: string;
  created_at: string;
  updated_at: string;
}

export interface ProfitLossReport {
  period: ReportPeriod;
  revenue_kobo: number;
  known_cogs_kobo: number;
  missing_cost_items: number;
  gross_profit_kobo: number | null;
  expenses_kobo: number;
  net_profit_kobo: number | null;
  sales_count: number;
  expense_count: number;
}
