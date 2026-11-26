// POST /functions/v1/paystack-webhook — called by Paystack, not by browsers (verify_jwt = false in config.toml).
// Security: (1) Paystack-Signature on the raw body (legacy header supported during migration),
// (2) successful charges are re-verified with Paystack's API,
// (3) Postgres re-checks the amount against the plan price, (4) every delivery is logged, (5) every handler is idempotent.
//
// In Paystack → Settings → API Keys & Webhooks, this URL receives all events. The ones that matter:
//   charge.success · invoice.payment_failed · subscription.create · subscription.not_renew · subscription.disable
import { handlePaystackEvent, billingDeps } from "../_shared/confirm.ts";
import { json } from "../_shared/http.ts";
import { verifyPaystackSignature, verifyPaystackWebhookSignature } from "../_shared/paystack.ts";
import { adminClient, env } from "../_shared/runtime.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const raw = new Uint8Array(await req.arrayBuffer());
  const webhookHeader = req.headers.get("paystack-signature");
  // Paystack's current signing secret (whsec_...) signs `timestamp.rawBody`.
  // Fall back to the older API-secret signature only for deliveries without the new header.
  const valid = webhookHeader
    ? await verifyPaystackWebhookSignature(raw, webhookHeader, Deno.env.get("PAYSTACK_WEBHOOK_SECRET") ?? "")
    : await verifyPaystackSignature(
      raw,
      req.headers.get("x-paystack-signature"),
      env("PAYSTACK_SECRET_KEY"),
    );
  if (!valid) return json({ error: "invalid_signature" }, 401);

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const db = adminClient();
  const reference = typeof event.data?.reference === "string" ? event.data.reference : null;

  // Log the delivery. A repeat delivery (Paystack retries) finds the existing row and reuses it.
  let logId: string | null = null;
  const inserted = await db
    .from("webhook_events")
    .insert({ provider: "paystack", event: event.event ?? "unknown", reference, payload: event })
    .select("id")
    .single();
  if (inserted.data) logId = inserted.data.id as string;
  else if (reference) {
    const existing = await db.from("webhook_events").select("id").eq("provider", "paystack").eq("event", event.event ?? "unknown").eq("reference", reference).maybeSingle();
    logId = (existing.data?.id as string | undefined) ?? null;
  }

  try {
    const result = await handlePaystackEvent(event, billingDeps());
    if (result.outcome === "ignored") console.warn("paystack webhook ignored", event.event, reference, result.detail);
    if (logId && result.outcome === "processed") {
      await db.from("webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", logId);
    }
    return json({ received: true, ...(result.outcome === "ignored" ? { ignored: result.detail } : {}) });
  } catch (e) {
    console.error("paystack webhook failed", event.event, reference, e);
    return json({ error: "processing_failed" }, 500); // non-2xx → Paystack retries later
  }
});
