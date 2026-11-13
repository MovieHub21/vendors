/** Typed wrappers around the Supabase Edge Functions (supabase/functions). The browser never writes to tables directly. */
import { supabase } from "../lib/supabase";
import { SLUG_MESSAGES } from "../lib/validation";
import { fail, ok, type Result } from "./result";

export interface StoreSummary {
  id: string;
  slug: string;
  name: string;
  category: string;
  city: string | null;
  state: string | null;
  is_published: boolean;
  status: "active" | "suspended";
}
/** The vendor's own store, including private fields. Only ever returned to its owner. */
export interface OwnStore {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string;
  category: string;
  city: string | null;
  state: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  og_image_url: string | null;
  logo_url: string | null;
  cover_url: string | null;
  indexable: boolean;
  contact_phone: string | null;
  contact_email: string | null;
  is_published: boolean;
  status: "active" | "suspended";
}
export interface SeoStatus {
  published: boolean;
  eligible: boolean;
  problems: string[];
  custom_title: boolean;
  custom_description: boolean;
  has_social_image: boolean;
  published_products: number;
  eligible_products: number;
}
export interface StoreSeoInput {
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  og_image_url?: string;
  indexable?: boolean;
  category?: string;
  city?: string;
  state?: string;
  tagline?: string;
  description?: string;
}

export interface SubscriptionSummary {
  plan_code: string;
  status: string;
  current_period_end: string;
  active: boolean;
}
export type NextStep = "create_store" | "subscribe" | "done";
export interface Me {
  user: { id: string; email: string | null };
  profile: { full_name: string; phone: string | null } | null;

  store: OwnStore | null;
  subscription: SubscriptionSummary | null;
  seo_status: SeoStatus | null;

  next_step: NextStep;
}
export interface StoreInput {
  name: string;
  slug: string;
  category: string;
  city?: string;
  state?: string;

  phone?: string;

}
export type PaymentStatus = "success" | "pending" | "failed";

const MESSAGES: Record<string, string> = {
  unauthorized: "Your session has expired. Please log in again.",
  slug_taken: SLUG_MESSAGES.taken,
  store_exists: "You already have a store.",
  store_required: "Create your store first.",
  payment_provider_error: "We couldn't start the payment. Please try again.",
  payment_not_found: "We couldn't find that payment.",
  payment_mismatch: "That payment didn't match your plan. Please contact support.",
  invalid_input: "Please check the details you entered.",

  nothing_to_update: "There were no changes to save.",
  body_too_large: "That request was too large.",
  subscription_required: "Your subscription has ended, so you can view your records but not change them. Renew to continue.",
  store_suspended: "Your store is suspended. Please contact support.",
  insufficient_stock: "There isn't enough stock for one of these products.",
  product_not_found: "That product wasn't found in your catalogue.",
  product_unavailable: "One of the products is no longer available.",
  customer_not_found: "That customer wasn't found.",
  order_not_found: "That order wasn't found.",
  order_cancelled: "This order is cancelled.",
  invalid_transition: "That status change isn't allowed.",
  overpayment: "That is more than the customer still owes.",
  invalid_payment: "Please check the payment details.",
  invalid_customer: "Please check the customer details.",
  invalid_item: "Please check the products and quantities.",
  no_items: "Add at least one product.",
  too_many_items: "A sale can have at most 50 lines.",
  too_many_orders: "Too many orders from this number. Please wait a while or contact the store.",
  store_not_found: "This store isn't available.",
};

export async function call<T>(name: string, body?: Record<string, unknown>): Promise<Result<T>> {

  if (!supabase) return fail("not_configured", "The service isn't connected yet. Please try again later.");
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (!error) return ok(data as T);

  let code = "request_failed";
  let detail = "";
  const response = (error as { context?: Response }).context;
  if (response && typeof response.json === "function") {
    try {
      const payload = (await response.json()) as { error?: string; message?: string };
      code = payload.error ?? code;
      detail = payload.message ?? "";
    } catch {
      /* not JSON: keep the generic message */
    }
  }
  const message =
    code === "invalid_slug"
      ? (SLUG_MESSAGES[detail] ?? SLUG_MESSAGES.invalid_characters)
      : (MESSAGES[code] ?? "Something went wrong. Please try again.");
  return fail(code, message);
}

export const getMe = () => call<Me>("me");
export const checkSlug = (slug: string) =>
  call<{ slug: string; available: boolean; reason?: string }>("check-slug", { slug });
export const createStore = (input: StoreInput) => call<{ store: StoreSummary }>("create-store", { ...input });
export const startSubscription = () =>
  call<{ authorization_url: string; reference: string }>("subscription-initialize", {});

export const updateStoreSeo = (input: StoreSeoInput) =>
  call<{ store: OwnStore; seo_status: SeoStatus }>("update-store-seo", { ...input });

export const verifyPayment = (reference: string) =>
  call<{ status: PaymentStatus }>("subscription-verify", { reference });
