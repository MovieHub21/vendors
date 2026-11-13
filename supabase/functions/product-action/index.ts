// POST /functions/v1/product-action { product_id, action: "duplicate" | "hide" | "show" | "delete" }
//   hide      → archived (disappears from the store and search, nothing is deleted)
//   show      → published
//   duplicate → a draft copy (same price, stock, description, images) to edit quickly
//   delete    → removes the product; past orders keep their own copy of its name and price
import { HttpError, readJsonObject } from "../_shared/http.ts";
import { adminClient, route } from "../_shared/runtime.ts";
import { uniqueSlug } from "../_shared/products.ts";
import { uuid } from "../_shared/sales.ts";
import { requireVendor } from "../_shared/vendor.ts";

const ACTIONS = ["duplicate", "hide", "show", "delete"];

Deno.serve(
  route(["POST"], async (req) => {
    const { store } = await requireVendor(req);
    const body = await readJsonObject(req);
    const id = uuid(body.product_id, "product_id");
    const action = typeof body.action === "string" ? body.action : "";
    if (!ACTIONS.includes(action)) throw new HttpError(422, "invalid_input", "That action isn't valid");
    const db = adminClient();

    const found = await db.from("products").select("*").eq("id", id).eq("store_id", store.id).maybeSingle();
    if (found.error) throw new HttpError(500, "internal_error", found.error.message);
    if (!found.data) throw new HttpError(404, "product_not_found", "That product wasn't found.");
    const p = found.data;

    if (action === "delete") {
      const del = await db.from("products").delete().eq("id", id).eq("store_id", store.id);
      if (del.error) throw new HttpError(500, "internal_error", del.error.message);
      return { deleted: true };
    }

    if (action === "hide" || action === "show") {
      const upd = await db
        .from("products")
        .update({ status: action === "hide" ? "archived" : "published" })
        .eq("id", id)
        .eq("store_id", store.id)
        .select("id, status")
        .single();
      if (upd.error) throw new HttpError(500, "internal_error", upd.error.message);
      return { product: upd.data };
    }

    // duplicate
    const slugs = await db.from("products").select("slug").eq("store_id", store.id);
    if (slugs.error) throw new HttpError(500, "internal_error", slugs.error.message);
    const name = `${String(p.name).slice(0, 112)} (copy)`;
    const copy = await db
      .from("products")
      .insert({
        store_id: store.id,
        name,
        slug: uniqueSlug(name, slugs.data.map((r) => r.slug as string)),
        description: p.description,
        price_kobo: p.price_kobo,
        category: p.category,
        stock_quantity: p.stock_quantity,
        is_available: p.is_available,
        status: "draft",
      })
      .select("id, slug, name, status")
      .single();
    if (copy.error) throw new HttpError(500, "internal_error", copy.error.message);

    const imgs = await db.from("product_images").select("url, alt_text, position, width, height").eq("product_id", id);
    if (!imgs.error && imgs.data.length > 0) {
      await db.from("product_images").insert(imgs.data.map((i) => ({ ...i, product_id: copy.data.id })));
    }
    return { product: copy.data };
  }),
);
