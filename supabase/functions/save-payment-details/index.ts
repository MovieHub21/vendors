// POST /functions/v1/save-payment-details { bank_name?, account_name?, account_number?, extra_note? }  →  { details }
// The bank / account details printed on invoices. Blank boxes are cleared; saving everything blank removes the row.
import { HttpError, readJsonObject } from "../_shared/http.ts";
import { adminClient, route } from "../_shared/runtime.ts";
import { hasPaymentDetails, parsePaymentDetails } from "../_shared/paymentDetails.ts";
import { requireVendor } from "../_shared/vendor.ts";

Deno.serve(
  route(["POST"], async (req) => {
    const { store } = await requireVendor(req);
    const details = parsePaymentDetails(await readJsonObject(req));
    const db = adminClient();

    if (!hasPaymentDetails(details)) {
      const { error } = await db.from("store_payment_details").delete().eq("store_id", store.id);
      if (error) throw new HttpError(500, "internal_error", error.message);
      return { details: null };
    }
    const { data, error } = await db
      .from("store_payment_details")
      .upsert({ store_id: store.id, ...details }, { onConflict: "store_id" })
      .select("bank_name, account_name, account_number, extra_note, updated_at")
      .single();
    if (error) {
      if (error.code === "23514") throw new HttpError(422, "invalid_payment_details", "Please check the account details.");
      throw new HttpError(500, "internal_error", error.message);
    }
    return { details: data };
  }),
);
