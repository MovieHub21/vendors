/**
 * What to do with each Paystack webhook event that is about money. Pure (everything it touches is injected),
 * so every branch is unit-tested in Node.
 *
 *   charge.success          our own checkout (reference starts ss_sub_)  → confirm it, as before
 *                           anything else = an automatic monthly renewal → verify with Paystack, then extend the vendor
 *   invoice.payment_failed  a renewal could not be charged               → flag it so the vendor sees it on their dashboard
 *   subscription.create     auto-renew switched on                       → link the vendor to their Paystack subscription
 *   subscription.not_renew / subscription.disable                        → auto-renew is off
 */
import { HttpError } from "./http.ts";
import type { PaystackVerifyData } from "./paystack.ts";

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** Paystack sends a plan either as the plan code or as an object that contains it. */
export function planCodeOf(plan: unknown): string | null {
  return str(plan) ?? str(obj(plan).plan_code);
}

export function customerOf(data: unknown): { code: string | null; email: string | null } {
  const c = obj(obj(data).customer);
  return { code: str(c.customer_code), email: str(c.email) };
}

/** true = it is OUR plan, false = a different plan (ignore it), null = Paystack didn't say. */
export function planMatches(seen: string | null, ours: string | null): boolean | null {
  return seen && ours ? seen === ours : null;
}

export interface RenewalArgs {
  customer_code: string;
  email: string | null;
  allow_email: boolean;
  reference: string;
  amount_kobo: number;
  currency: string;
  transaction_id: number;
  channel: string | null;
  paid_at: string | null;
}

export interface BillingDeps {
  /** PAYSTACK_PLAN_CODE: the plan that auto-renews our subscriptions. */
  ourPlanCode: string | null;
  confirmCheckout(reference: string): Promise<unknown>;
  verify(reference: string): Promise<PaystackVerifyData>;
  applyRenewal(args: RenewalArgs): Promise<{ already_applied: boolean }>;
  recordFailure(args: { customer_code: string; email: string | null; allow_email: boolean; reference: string | null; reason: string }): Promise<void>;
  recordState(args: { customer_code: string; email: string | null; allow_email: boolean; state: "created" | "not_renew" | "disabled"; subscription_code: string | null }): Promise<void>;
}

export type EventResult = { outcome: "processed" | "ignored"; detail: string };
const ignored = (detail: string): EventResult => ({ outcome: "ignored", detail });
const done = (detail: string): EventResult => ({ outcome: "processed", detail });

/** "I don't know this vendor / that isn't our price" are not errors worth retrying: acknowledge and log. */
const EXPECTED = new Set(["billing_account_not_found", "payment_mismatch", "payment_not_found"]);
async function guarded(fn: () => Promise<EventResult>): Promise<EventResult> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError && EXPECTED.has(e.code)) return ignored(e.code);
    throw e;
  }
}

export async function handlePaystackEvent(event: { event?: string; data?: unknown }, deps: BillingDeps): Promise<EventResult> {
  const data = obj(event.data);

  switch (event.event) {
    case "charge.success": {
      const reference = str(data.reference);
      if (!reference) return ignored("no_reference");

      if (reference.startsWith("ss_sub_")) {
        return guarded(async () => {
          await deps.confirmCheckout(reference);
          return done("checkout_confirmed");
        });
      }

      // An automatic renewal. The reference is Paystack's own, so ask Paystack what it really was.
      const verified = await deps.verify(reference);
      if (verified.reference !== reference || verified.status !== "success") return ignored("not_a_successful_charge");

      const seen = customerOf(verified);
      const fromEvent = customerOf(data);
      const customerCode = seen.code ?? fromEvent.code;
      if (!customerCode) return ignored("no_customer");

      const planSeen = planCodeOf(verified.plan) ?? planCodeOf(verified.plan_object) ?? planCodeOf(data.plan);
      const ours = planMatches(planSeen, deps.ourPlanCode);
      if (ours === false) return ignored("different_plan");

      return guarded(async () => {
        const r = await deps.applyRenewal({
          customer_code: customerCode,
          email: seen.email ?? fromEvent.email,
          allow_email: ours === true, // only trust the email when Paystack says the charge was for OUR plan
          reference,
          amount_kobo: verified.amount,
          currency: verified.currency,
          transaction_id: verified.id,
          channel: verified.channel ?? null,
          paid_at: verified.paid_at ?? null,
        });
        return done(r.already_applied ? "renewal_already_applied" : "renewal_applied");
      });
    }

    case "invoice.payment_failed": {
      const { code, email } = customerOf(data);
      if (!code) return ignored("no_customer");
      const subscription = obj(data.subscription);
      const ours = planMatches(planCodeOf(subscription.plan) ?? planCodeOf(data.plan), deps.ourPlanCode);
      if (ours === false) return ignored("different_plan");
      const tx = obj(data.transaction);
      return guarded(async () => {
        await deps.recordFailure({
          customer_code: code,
          email,
          allow_email: ours === true,
          reference: str(tx.reference) ?? str(data.reference),
          reason: str(tx.gateway_response) ?? str(data.description) ?? str(data.message) ?? "The payment was declined.",
        });
        return done("renewal_failure_recorded");
      });
    }

    case "subscription.create":
    case "subscription.not_renew":
    case "subscription.disable": {
      const { code, email } = customerOf(data);
      if (!code) return ignored("no_customer");
      const ours = planMatches(planCodeOf(data.plan), deps.ourPlanCode);
      if (ours === false) return ignored("different_plan");
      const state = event.event === "subscription.create" ? "created" : event.event === "subscription.not_renew" ? "not_renew" : "disabled";
      return guarded(async () => {
        await deps.recordState({ customer_code: code, email, allow_email: ours === true, state, subscription_code: str(data.subscription_code) });
        return done(`subscription_${state}`);
      });
    }

    default:
      return ignored("not_a_billing_event");
  }
}
