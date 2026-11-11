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
  store: StoreSummary | null;
  subscription: SubscriptionSummary | null;
  next_step: NextStep;
}
export interface StoreInput {
  name: string;
  slug: string;
  category: string;
  city?: string;
  state?: string;
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
  body_too_large: "That request was too large.",
};

async function call<T>(name: string, body?: Record<string, unknown>): Promise<Result<T>> {
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
export const verifyPayment = (reference: string) =>
  call<{ status: PaymentStatus }>("subscription-verify", { reference });
