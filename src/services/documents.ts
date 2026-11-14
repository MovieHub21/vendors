/**
 * Receipt and invoice designs, bank details and live invoices.
 * Reads go straight from the browser under Row Level Security (a vendor only ever sees their own rows);
 * every write goes through an edge function, which validates the design and generates the stored CSS itself.
 */
import type { BankDetails } from "../lib/docContent";
import { defaultTemplate, templateToCss, validateTemplate, type DocKind, type Template } from "../lib/docTemplate";
import type { ReceiptSnapshot } from "../lib/sales";
import { supabase } from "../lib/supabase";
import { call } from "./api";
import { fail, ok, type Result } from "./result";

export interface StoredTemplate {
  kind: DocKind;
  template: Template;
  /** The CSS saved with the design. The page is drawn from this, not regenerated. */
  css: string;
  updatedAt: string | null;
  /** True when the vendor has not saved a design of their own yet. */
  isDefault: boolean;
}

export interface InvoiceRecord {
  invoice_no: string;
  issued_at: string;
  bank: BankDetails | null;
  snapshot: ReceiptSnapshot;
}

const NOT_CONFIGURED = "The service isn't connected yet. Please try again later.";
const FAILED = "We couldn't load this. Please refresh and try again.";

export function builtInTemplate(kind: DocKind): StoredTemplate {
  const template = defaultTemplate(kind);
  return { kind, template, css: templateToCss(template), updatedAt: null, isDefault: true };
}

/** The vendor's saved design, or the built-in one. A saved design that somehow no longer validates falls back to the built-in. */
export async function loadTemplate(kind: DocKind): Promise<Result<StoredTemplate>> {
  if (!supabase) return fail("not_configured", NOT_CONFIGURED);
  const { data, error } = await supabase.from("document_templates").select("layout, css, updated_at").eq("kind", kind).maybeSingle();
  if (error) return fail("request_failed", FAILED);
  if (!data) return ok(builtInTemplate(kind));
  try {
    return ok({ kind, template: validateTemplate(data.layout), css: data.css as string, updatedAt: data.updated_at as string, isDefault: false });
  } catch {
    return ok(builtInTemplate(kind));
  }
}

export async function loadPaymentDetails(): Promise<Result<BankDetails | null>> {
  if (!supabase) return fail("not_configured", NOT_CONFIGURED);
  const { data, error } = await supabase.from("store_payment_details").select("bank_name, account_name, account_number, extra_note").maybeSingle();
  return error ? fail("request_failed", FAILED) : ok((data as BankDetails | null) ?? null);
}

export const getInvoice = (orderId: string) => call<{ invoice: InvoiceRecord }>("order-invoice", { order_id: orderId });

export const saveTemplate = (kind: DocKind, template: Template) =>
  call<{ template: { kind: DocKind; layout: unknown; css: string; updated_at: string } }>("save-document-template", { kind, layout: template });

export const resetTemplate = (kind: DocKind) => call<{ template: null }>("save-document-template", { kind, reset: true });

export const savePaymentDetails = (details: BankDetails) =>
  call<{ details: (BankDetails & { updated_at: string }) | null }>("save-payment-details", { ...details });
