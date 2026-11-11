// POST /functions/v1/subscription-initialize  →  { authorization_url, reference }
// Starts a Paystack checkout for the monthly plan. The price comes from the database, never from the browser.
import { HttpError } from "../_shared/http.ts";
import { newReference } from "../_shared/payments.ts";
import { createPaystackClient } from "../_shared/paystack.ts";
import { adminClient, env, requireUser, route } from "../_shared/runtime.ts";

Deno.serve(
  route(["POST"], async (req) => {
    const user = await requireUser(req);
    if (!user.email) throw new HttpError(400, "email_required", "Your account needs an email address.");
    const db = adminClient();

    const store = await db.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
    if (store.error) throw new HttpError(500, "internal_error", store.error.message);
    if (!store.data) throw new HttpError(409, "store_required", "Create your store first.");

    const plan = await db
      .from("subscription_plans")
      .select("code, price_kobo")
      .eq("code", "monthly")
      .eq("is_active", true)
      .single();
    if (plan.error) throw new HttpError(500, "internal_error", plan.error.message);

    const reference = newReference();
    const pending = await db.from("payments").insert({
      owner_id: user.id,
      plan_code: plan.data.code,
      reference,
      amount_kobo: plan.data.price_kobo,
    });
    if (pending.error) throw new HttpError(500, "internal_error", pending.error.message);

    try {
      const paystack = createPaystackClient(env("PAYSTACK_SECRET_KEY"));
      const tx = await paystack.initialize({
        email: user.email,
        amountKobo: plan.data.price_kobo,
        reference,
        callbackUrl: `${env("SITE_URL").replace(/\/+$/, "")}/onboarding/payment`,
        planCode: Deno.env.get("PAYSTACK_PLAN_CODE") || undefined, // set it to turn on automatic monthly renewal
        metadata: { owner_id: user.id, store_id: store.data.id, plan_code: plan.data.code },
      });
      return { authorization_url: tx.authorization_url, reference };
    } catch (e) {
      await db.from("payments").update({ status: "failed" }).eq("reference", reference);
      console.error("paystack initialize failed", e);
      throw new HttpError(502, "payment_provider_error", "We couldn't start the payment. Please try again.");
    }
  }),
);
