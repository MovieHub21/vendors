// POST /functions/v1/subscription-verify  { reference }  →  { status: 'success' | 'pending' | 'failed' }
// Called by the app after Paystack sends the vendor back. The webhook does the same job; whichever arrives first wins.
import { confirmReference } from "../_shared/confirm.ts";
import { HttpError, readJsonObject } from "../_shared/http.ts";
import { adminClient, requireUser, route } from "../_shared/runtime.ts";

Deno.serve(
  route(["POST"], async (req) => {
    const user = await requireUser(req);
    const body = await readJsonObject(req);
    const reference = typeof body.reference === "string" ? body.reference.trim() : "";
    if (!/^[A-Za-z0-9._=-]{6,100}$/.test(reference)) throw new HttpError(422, "invalid_reference");

    const db = adminClient();
    const payment = await db.from("payments").select("owner_id").eq("reference", reference).maybeSingle();
    if (payment.error) throw new HttpError(500, "internal_error", payment.error.message);
    // Same answer for "not yours" and "doesn't exist", so references cannot be probed.
    if (!payment.data || payment.data.owner_id !== user.id) throw new HttpError(404, "payment_not_found");

    const result = await confirmReference(reference);
    return { status: result.status };
  }),
);
