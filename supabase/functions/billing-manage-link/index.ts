// POST /functions/v1/billing-manage-link  →  { link } or { fallback: "checkout" }
// "Update card": where the vendor can change the card behind their automatic monthly payment.
// Works even when their subscription has ended: a vendor with a failed renewal must be able to fix it.
import { createPaystackClient } from "../_shared/paystack.ts";
import { adminClient, env, requireUser, route } from "../_shared/runtime.ts";

Deno.serve(
  route(["POST"], async (req) => {
    const user = await requireUser(req);
    const db = adminClient();

    const [account, sub] = await Promise.all([
      db.from("billing_accounts").select("paystack_subscription_code").eq("owner_id", user.id).maybeSingle(),
      db.from("subscriptions").select("auto_renew").eq("owner_id", user.id).maybeSingle(),
    ]);
    const code = account.data?.paystack_subscription_code as string | null | undefined;

    // No automatic subscription to manage (or it was cancelled): start a normal checkout instead.
    if (!code || sub.data?.auto_renew === false) return { fallback: "checkout" };

    try {
      const { link } = await createPaystackClient(env("PAYSTACK_SECRET_KEY")).manageLink(code);
      return { link };
    } catch (e) {
      console.error("manage link failed", e);
      return { fallback: "checkout" };
    }
  }),
);
