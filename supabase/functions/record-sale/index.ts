// POST /functions/v1/record-sale { customer_id? | customer{name,phone?,email?,address?}, items[], channel, paid_kobo?, method?, note? }
// A sale made outside the storefront (WhatsApp, Instagram, phone, walk-in…). Totals, balance and stock are decided in Postgres.
import { readJsonObject } from "../_shared/http.ts";
import { adminClient, route } from "../_shared/runtime.ts";
import { parseSale, rpcError } from "../_shared/sales.ts";
import { requireVendor } from "../_shared/vendor.ts";

Deno.serve(
  route(["POST"], async (req) => {
    const { store } = await requireVendor(req);
    const sale = parseSale(await readJsonObject(req));
    const { data, error } = await adminClient().rpc("record_sale", {
      p_store_id: store.id, // from the login, never from the request
      p_customer_id: sale.customer_id,
      p_customer: sale.customer,
      p_items: sale.items,
      p_channel: sale.channel,
      p_paid_kobo: sale.paid_kobo,
      p_method: sale.method,
      p_note: sale.note,
    });
    if (error) throw rpcError(error);
    return { sale: data };
  }),
);
