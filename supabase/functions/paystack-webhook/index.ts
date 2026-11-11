// POST /functions/v1/paystack-webhook — called by Paystack, not by browsers (verify_jwt = false in config.toml).
// Security: (1) HMAC signature on the raw body, (2) the payment is re-verified with Paystack's API,
// (3) Postgres re-checks the amount against the stored payment and plan price, (4) every delivery is logged once.
import { HttpError, json } from "../_shared/http.ts";
import { verifyPaystackSignature } from "../_shared/paystack.ts";
import { confirmReference } from "../_shared/confirm.ts";
import { adminClient, env } from "../_shared/runtime.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const raw = await req.text();
  const valid = await verifyPaystackSignature(raw, req.headers.get("x-paystack-signature"), env("PAYSTACK_SECRET_KEY"));
  if (!valid) return json({ error: "invalid_signature" }, 401);

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const reference = event.data?.reference ?? null;
  const db = adminClient();
  await db
    .from("webhook_events")
    .upsert(
      { provider: "paystack", event: event.event ?? "unknown", reference, payload: event },
      { onConflict: "provider,event,reference", ignoreDuplicates: true },
    );

  // Only successful charges change anything. Everything else is acknowledged so Paystack stops retrying.
  if (event.event === "charge.success" && reference) {
    try {
      await confirmReference(reference);
    } catch (e) {
      // A payment we never created (e.g. another product on the same Paystack account): acknowledge and move on.
      if (e instanceof HttpError && (e.code === "payment_not_found" || e.code === "payment_mismatch")) {
        console.warn("paystack webhook ignored", reference, e.code);
        return json({ received: true, ignored: e.code });
      }
      console.error("paystack webhook failed", e);
      return json({ error: "processing_failed" }, 500); // non-2xx → Paystack retries
    }
    await db
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("provider", "paystack")
      .eq("event", "charge.success")
      .eq("reference", reference);
  }
  return json({ received: true });
});
