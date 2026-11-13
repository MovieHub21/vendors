// POST /functions/v1/save-product { product_id?, name, price_kobo, description?, category?, status?, is_available?, stock_quantity?, images? }
// Creates a product, or edits one of the caller's own (product_id). The store always comes from the login.
import { HttpError, readJsonObject } from "../_shared/http.ts";
import { adminClient, route } from "../_shared/runtime.ts";
import { parseProduct, uniqueSlug } from "../_shared/products.ts";
import { uuid } from "../_shared/sales.ts";
import { requireVendor } from "../_shared/vendor.ts";

const COLUMNS = "id, slug, name, description, price_kobo, category, status, is_available, stock_quantity, created_at, updated_at";

Deno.serve(
  route(["POST"], async (req) => {
    const { store } = await requireVendor(req);
    const body = await readJsonObject(req);
    const db = adminClient();
    const editing = body.product_id !== undefined && body.product_id !== null;
    const input = parseProduct(body, !editing);
    const { images, ...fields } = input;

    let product: Record<string, unknown>;
    if (editing) {
      const id = uuid(body.product_id, "product_id");
      if (Object.keys(fields).length > 0) {
        const { data, error } = await db.from("products").update(fields).eq("id", id).eq("store_id", store.id).select(COLUMNS).maybeSingle();
        if (error) throw new HttpError(error.code === "23514" ? 422 : 500, "invalid_input", error.message);
        if (!data) throw new HttpError(404, "product_not_found", "That product wasn't found.");
        product = data;
      } else {
        const { data, error } = await db.from("products").select(COLUMNS).eq("id", id).eq("store_id", store.id).maybeSingle();
        if (error) throw new HttpError(500, "internal_error", error.message);
        if (!data) throw new HttpError(404, "product_not_found", "That product wasn't found.");
        product = data;
      }
    } else {
      const existing = await db.from("products").select("slug").eq("store_id", store.id);
      if (existing.error) throw new HttpError(500, "internal_error", existing.error.message);
      const slug = uniqueSlug(String(fields.name), existing.data.map((r) => r.slug as string));
      const { data, error } = await db
        .from("products")
        .insert({ ...fields, store_id: store.id, slug, status: fields.status ?? "draft" })
        .select(COLUMNS)
        .single();
      if (error) {
        if (error.code === "23505") throw new HttpError(409, "slug_taken", "Please try saving again.");
        throw new HttpError(error.code === "23514" ? 422 : 500, "invalid_input", error.message);
      }
      product = data;
    }

    if (images) {
      const productId = product.id as string;
      const old = await db.from("product_images").select("id").eq("product_id", productId);
      if (old.error) throw new HttpError(500, "internal_error", old.error.message);
      if (images.length > 0) {
        const ins = await db
          .from("product_images")
          .insert(images.map((img, position) => ({ product_id: productId, url: img.url, alt_text: img.alt_text, position })));
        if (ins.error) {
          if (!editing) await db.from("products").delete().eq("id", productId).eq("store_id", store.id);
          throw new HttpError(422, "invalid_input", "One of the images isn't allowed.");
        }
      }
      const oldIds = old.data.map((r) => r.id as string);
      if (oldIds.length > 0) await db.from("product_images").delete().in("id", oldIds);
    }
    return { product };
  }),
);
