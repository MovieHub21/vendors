import { HttpError } from "./http.ts";
import { kobo, uuid } from "./sales.ts";
import { cleanText } from "./seoFields.ts";

export const EXPENSE_CATEGORIES = ["rent", "utilities", "transport", "packaging", "delivery", "marketing", "wages", "fees", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ReportPeriod = "today" | "month" | "all_time";

export function parseReportPeriod(value: unknown): ReportPeriod {
  if (value === undefined) return "today";
  if (value === "today" || value === "month" || value === "all_time") return value;
  throw new HttpError(422, "invalid_input", "Choose today, this month or all time.");
}

export function parseExpense(body: Record<string, unknown>) {
  const id = body.id === undefined || body.id === null || body.id === "" ? null : uuid(body.id, "Expense id");
  const amount_kobo = kobo(body.amount_kobo, "Amount", 1);
  const category = body.category;
  if (typeof category !== "string" || !(EXPENSE_CATEGORIES as readonly string[]).includes(category)) {
    throw new HttpError(422, "invalid_input", "Choose a valid expense category.");
  }
  const description = cleanText(body.description, "Description", 150, 2);
  if (description === null) throw new HttpError(422, "invalid_input", "Add a short description for this expense.");
  const incurred_on = body.incurred_on;
  if (typeof incurred_on !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(incurred_on)) {
    throw new HttpError(422, "invalid_input", "Enter a valid expense date.");
  }
  const parsedDate = new Date(`${incurred_on}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== incurred_on) {
    throw new HttpError(422, "invalid_input", "Enter a valid expense date.");
  }
  const todayInLagos = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
  if (incurred_on > todayInLagos) throw new HttpError(422, "invalid_input", "An expense date can't be in the future.");
  return { id, amount_kobo, category: category as ExpenseCategory, description, incurred_on };
}
