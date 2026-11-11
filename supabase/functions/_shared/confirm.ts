/** Deno-side wiring of confirmPayment to Paystack and Postgres. Used by the webhook and by subscription-verify. */
import { HttpError } from "./http.ts";
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
      return data as { already_applied: boolean };
    },
    markFailed: async (ref) => {
      await db.from("payments").update({ status: "failed" }).eq("reference", ref).eq("status", "pending");
    },
  });
}
