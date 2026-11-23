import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert } from "../components/AuthLayout";
import { DashboardShell } from "../components/DashboardShell";
import { Field } from "../components/Field";
import { PAGE_META } from "../data/pageMeta";
import { formatNaira } from "../lib/money";
import { EXPENSE_CATEGORIES, REPORT_PERIODS, type BusinessExpense, type ExpenseCategory, type ProfitLossReport, type ReportPeriod } from "../lib/finance";
import { koboToInput, nairaToKobo } from "../lib/sales";
import { deleteExpense, getProfitLossReport, listExpenses, saveExpense } from "../services/finance";

const todayInLagos = () => new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
const categoryLabel = (category: ExpenseCategory) => EXPENSE_CATEGORIES.find(([id]) => id === category)?.[1] ?? category;

interface ExpenseFormState {
  id?: string;
  amount: string;
  category: ExpenseCategory;
  description: string;
  incurred_on: string;
}

const newExpense = (): ExpenseFormState => ({ amount: "", category: "other", description: "", incurred_on: todayInLagos() });

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="stat-tile"><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>;
}

function ProfitLossView() {
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [report, setReport] = useState<ProfitLossReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(true);
  const [reportReload, setReportReload] = useState(0);
  const [expenses, setExpenses] = useState<BusinessExpense[] | null>(null);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseFormState>(newExpense);
  const [formOpen, setFormOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getProfitLossReport(period).then((result) => {
      if (cancelled) return;
      if (result.ok) setReport(result.data.report);
      else setReportError(result.message);
    }).catch(() => {
      if (!cancelled) setReportError("We couldn't load this report. Please try again.");
    }).finally(() => {
      if (!cancelled) setReportBusy(false);
    });
    return () => { cancelled = true; };
  }, [period, reportReload]);

  const loadExpenses = useCallback(async () => {
    const result = await listExpenses();
    if (result.ok) {
      setExpenses(result.data.expenses);
      setExpenseError(null);
    } else setExpenseError(result.message);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listExpenses().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setExpenses(result.data.expenses);
        setExpenseError(null);
      } else setExpenseError(result.message);
    });
    return () => { cancelled = true; };
  }, []);

  const visibleExpenses = useMemo(() => {
    if (!expenses) return [];
    const today = todayInLagos();
    if (period === "today") return expenses.filter((expense) => expense.incurred_on === today);
    if (period === "month") return expenses.filter((expense) => expense.incurred_on.slice(0, 7) === today.slice(0, 7));
    return expenses;
  }, [expenses, period]);

  function editExpense(expense: BusinessExpense) {
    setForm({
      id: expense.id,
      amount: koboToInput(expense.amount_kobo),
      category: expense.category,
      description: expense.description,
      incurred_on: expense.incurred_on,
    });
    setFormOpen(true);
    setExpenseError(null);
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExpenseError(null);
    const amount = nairaToKobo(form.amount);
    if (amount === null || amount < 1) return setExpenseError("Enter an expense greater than ₦0.");
    if (form.description.trim().length < 2) return setExpenseError("Add a short description for this expense.");
    if (!form.incurred_on || form.incurred_on > todayInLagos()) return setExpenseError("Choose a valid date up to today.");

    setSaveBusy(true);
    const result = await saveExpense({
      ...(form.id ? { id: form.id } : {}),
      amount_kobo: amount,
      category: form.category,
      description: form.description.trim(),
      incurred_on: form.incurred_on,
    });
    setSaveBusy(false);
    if (!result.ok) return setExpenseError(result.message);
    setExpenses((current) => [result.data.expense, ...(current ?? []).filter((expense) => expense.id !== result.data.expense.id)]
      .sort((a, b) => b.incurred_on.localeCompare(a.incurred_on) || b.created_at.localeCompare(a.created_at)));
    setForm(newExpense());
    setFormOpen(false);
    setReportBusy(true);
    setReportReload((value) => value + 1);
  }

  async function removeExpense(expense: BusinessExpense) {
    if (!window.confirm(`Delete “${expense.description}” (${formatNaira(expense.amount_kobo)})? This will change the profit report.`)) return;
    setExpenseError(null);
    setDeleteBusy(expense.id);
    const result = await deleteExpense(expense.id);
    setDeleteBusy(null);
    if (!result.ok) return setExpenseError(result.message);
    setExpenses((current) => (current ?? []).filter((item) => item.id !== expense.id));
    setReportBusy(true);
    setReportReload((value) => value + 1);
  }

  const incomplete = (report?.missing_cost_items ?? 0) > 0;

  return (
    <>
      <div className="dash-sales-periods" role="group" aria-label="Report period">
        {REPORT_PERIODS.map((option) => (
        <button key={option.id} type="button" className={period === option.id ? "is-active" : ""}
            aria-pressed={period === option.id} onClick={() => { setReport(null); setReportBusy(true); setReportError(null); setPeriod(option.id); }}>
            {option.label}
          </button>
        ))}
      </div>

      {reportError && <Alert kind="error">{reportError} <button className="link-button" type="button" onClick={() => { setReportBusy(true); setReportError(null); setReportReload((value) => value + 1); }}>Try again</button></Alert>}
      {reportBusy && <p className="auth-loading" role="status">Calculating your report…</p>}
      {report && !reportBusy && (
        <>
          {incomplete && (
            <Alert kind="info">
              Profit is incomplete: {report.missing_cost_items} sold item line{report.missing_cost_items === 1 ? " has" : "s have"} no cost recorded. Enter the cost on the relevant order to complete this report. <Link to="/dashboard/orders">Open orders</Link>
            </Alert>
          )}
          <div className="stat-grid-dash profit-loss-metrics">
            <Metric label="Sales revenue" value={formatNaira(report.revenue_kobo)} hint={`${report.sales_count} confirmed sale${report.sales_count === 1 ? "" : "s"}`} />
            <Metric label={incomplete ? "Known item costs" : "Cost of items sold"} value={formatNaira(report.known_cogs_kobo)} />
            <Metric label="Gross profit" value={report.gross_profit_kobo === null ? "Incomplete" : formatNaira(report.gross_profit_kobo)} />
            <Metric label="Operating expenses" value={formatNaira(report.expenses_kobo)} hint={`${report.expense_count} expense${report.expense_count === 1 ? "" : "s"}`} />
            <Metric label="Estimated net profit" value={report.net_profit_kobo === null ? "Incomplete" : formatNaira(report.net_profit_kobo)} />
          </div>
        </>
      )}

      <p className="profit-loss-method muted">
        Confirmed sales count as revenue even if the customer still owes you; pending and cancelled orders are excluded. Record operating expenses here. Product costs are counted when items sell, so don’t add stock purchases as expenses. This estimate excludes taxes, loans and owner withdrawals.
      </p>

      <section className="dash-card profit-loss-expenses">
        <div className="dash-head-row profit-loss-expenses-head">
          <div><h2>Operating expenses</h2><p className="muted">{period === "today" ? "Today" : period === "month" ? "This month" : "All time"}</p></div>
          <button type="button" className="btn btn-primary btn-small" onClick={() => { setForm(newExpense()); setFormOpen(true); setExpenseError(null); }}>
            <Plus size={15} aria-hidden="true" /> Add expense
          </button>
        </div>

        {formOpen && (
          <form className="profit-loss-expense-form" onSubmit={(event) => void submitExpense(event)} noValidate>
            <div className="field-row">
              <Field label="Description" value={form.description} maxLength={150} placeholder="e.g. Delivery bags" onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              <Field label="Amount (₦)" inputMode="decimal" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
            </div>
            <div className="field-row">
              <div className="field"><label htmlFor="expense-category">Category</label><select id="expense-category" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as ExpenseCategory }))}>{EXPENSE_CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
              <Field label="Date incurred" type="date" value={form.incurred_on} max={todayInLagos()} onChange={(event) => setForm((current) => ({ ...current, incurred_on: event.target.value }))} />
            </div>
            {expenseError && <Alert kind="error">{expenseError}</Alert>}
            <div className="quick-actions">
              <button className="btn btn-primary" type="submit" disabled={saveBusy}>{saveBusy ? "Saving…" : form.id ? "Save changes" : "Save expense"}</button>
              <button className="btn btn-outline" type="button" disabled={saveBusy} onClick={() => { setFormOpen(false); setForm(newExpense()); }}><X size={15} /> Cancel</button>
            </div>
          </form>
        )}

        {expenseError && !formOpen && <Alert kind="error">{expenseError} <button className="link-button" type="button" onClick={() => void loadExpenses()}>Try again</button></Alert>}
        {!expenses && !expenseError && <p className="auth-loading">Loading expenses…</p>}
        {expenses && visibleExpenses.length === 0 && <p className="empty">No expenses recorded for this period.</p>}
        {visibleExpenses.length > 0 && (
          <ul className="dash-list profit-loss-expense-list">
            {visibleExpenses.map((expense) => (
              <li key={expense.id}>
                <span><b>{expense.description}</b><small>{dateLabel(expense.incurred_on)} · {categoryLabel(expense.category)}</small></span>
                <span className="profit-loss-expense-actions"><strong>{formatNaira(expense.amount_kobo)}</strong>
                  <button type="button" className="icon-btn" aria-label={`Edit ${expense.description}`} onClick={() => editExpense(expense)}><Pencil size={15} /></button>
                  <button type="button" className="icon-btn" aria-label={`Delete ${expense.description}`} disabled={deleteBusy === expense.id} onClick={() => void removeExpense(expense)}><Trash2 size={15} /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function ProfitLoss() {
  return (
    <DashboardShell seo={PAGE_META.dashboardProfitLoss} title="Profit & loss">
      {() => <ProfitLossView />}
    </DashboardShell>
  );
}
