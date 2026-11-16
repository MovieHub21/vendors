/** Deno-side wiring of confirmPayment to Paystack and Postgres. Used by the webhook and by subscription-verify. */
import { HttpError } from "./http.ts";
import { handlePaystackEvent, type BillingDeps } from "./billingEvents.ts";
import { confirmPayment, type ConfirmResult } from "./payments.ts";
import { createPaystackClient } from "./paystack.ts";
import { adminClient, env } from "./runtime.ts";

export async function confirmReference(reference: string): Promise<ConfirmResult> {
  const db = adminClient();
  const paystack = createPaystackClient(env("PAYSTACK_SECRET_KEY"));

  return confirmPayment(reference, {
    verify: (ref) => paystack.verify(ref),
    apply: async (args) => {
      const { data, error } = await db.rpc("apply_successful_payment", {
        p_reference: args.reference,
        p_amount_kobo: args.amount_kobo,
        p_currency: args.currency,
        p_transaction_id: args.transaction_id,
        p_channel: args.channel,
        p_paid_at: args.paid_at,
      });
      if (error) {
        if (error.message.includes("payment_not_found")) throw new HttpError(404, "payment_not_found");
        if (error.message.includes("payment_mismatch")) throw new HttpError(409, "payment_mismatch");
        throw new HttpError(500, "internal_error", error.message);
      }
      const result = data as { already_applied: boolean; owner_id?: string };
      // Remember who this Paystack customer is, so their automatic renewals can be matched to them later.
      if (args.customer_code && result.owner_id) {
        const link = await db.rpc("link_billing_account", { p_owner: result.owner_id, p_customer_code: args.customer_code, p_subscription_code: null });
        if (link.error) console.error("could not link billing account", link.error.message);
      }
      return result;
    },
    markFailed: async (ref) => {
      await db.from("payments").update({ status: "failed" }).eq("reference", ref).eq("status", "pending");
    },
  });
}

const rpcError = (error: { message: string }): HttpError => {
  for (const code of ["billing_account_not_found", "payment_mismatch", "payment_not_found"]) {
    if (error.message.includes(code)) return new HttpError(409, code);
  }
  return new HttpError(500, "internal_error", error.message);
};

/** Deno-side wiring of the renewal / failure / auto-renew handlers to Paystack and Postgres. */
export function billingDeps(): BillingDeps {
  const db = adminClient();
  const paystack = createPaystackClient(env("PAYSTACK_SECRET_KEY"));
  return {
    ourPlanCode: Deno.env.get("PAYSTACK_PLAN_CODE") || null,
    confirmCheckout: confirmReference,
    verify: (ref) => paystack.verify(ref),
    applyRenewal: async (a) => {
      const { data, error } = await db.rpc("apply_renewal_payment", {
        p_customer_code: a.customer_code, p_email: a.email, p_allow_email: a.allow_email, p_reference: a.reference,
        p_amount_kobo: a.amount_kobo, p_currency: a.currency, p_transaction_id: a.transaction_id, p_channel: a.channel, p_paid_at: a.paid_at,
      });
      if (error) throw rpcError(error);
      return data as { already_applied: boolean };
    },
    recordFailure: async (a) => {
      const { error } = await db.rpc("record_renewal_failure", {
        p_customer_code: a.customer_code, p_email: a.email, p_allow_email: a.allow_email, p_reference: a.reference, p_reason: a.reason,
      });
      if (error) throw rpcError(error);
    },
    recordState: async (a) => {
      const { error } = await db.rpc("record_subscription_state", {
        p_customer_code: a.customer_code, p_email: a.email, p_allow_email: a.allow_email, p_state: a.state, p_subscription_code: a.subscription_code,
      });
      if (error) throw rpcError(error);
    },
  };
}

export { handlePaystackEvent };
