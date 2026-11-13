/** Product input validation + slug generation. Pure (no Deno APIs) so it is unit-tested in Node. */
import { HttpError } from "./http.ts";
import { cleanHttpsUrl, cleanMultilineText, cleanText } from "./seoFields.ts";

export const PRODUCT_STATUSES = ["draft", "published", "archived"] as const;
export const MAX_PRODUCT_KOBO = 2_000_000_000; // products.price_kobo is a 32-bit integer
export const MAX_IMAGES = 8;

export interface ProductImageInput {
  url: string;
  alt_text: string | null;
}

export interface ProductInput {
  name?: string;
  description?: string;
  price_kobo?: number;
  category?: string | null;
  status?: (typeof PRODUCT_STATUSES)[number];
  is_available?: boolean;
  stock_quantity?: number | null;
  images?: ProductImageInput[];
}

/** Same rule as public.slugify() in SQL. */
export function slugify(text: string): string {
  const s = text.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s.slice(0, 70).replace(/-+$/g, "");
}

/** "Body wave wig" → body-wave-wig, then body-wave-wig-2, -3… if taken. `taken` holds the store's existing slugs. */
export function uniqueSlug(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugify(name).length >= 2 ? slugify(name) : "product";
  if (!used.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/** Only keys present in the request are returned, so a single field can be saved. `creating` makes name and price required. */
export function parseProduct(body: Record<string, unknown>, creating: boolean): ProductInput {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const out: ProductInput = {};

  if (has("name") || creating) {
    const name = cleanText(body.name, "Name", 120, 2);
    if (name === null) throw new HttpError(422, "invalid_input", "Product name is required");
    out.name = name;
  }
  if (has("description")) out.description = cleanMultilineText(body.description, "Description", 5000) ?? "";
  if (has("price_kobo") || creating) {
    const p = body.price_kobo;
    if (typeof p !== "number" || !Number.isSafeInteger(p) || p < 1 || p > MAX_PRODUCT_KOBO) {
      throw new HttpError(422, "invalid_input", "Price must be at least ₦0.01 and a whole number of kobo");
    }
    out.price_kobo = p;
  }
  if (has("category")) out.category = cleanText(body.category, "Category", 40);
  if (has("status")) {
    if (typeof body.status !== "string" || !(PRODUCT_STATUSES as readonly string[]).includes(body.status)) {
      throw new HttpError(422, "invalid_input", "Status is not valid");
    }
    out.status = body.status as ProductInput["status"];
  }
  if (has("is_available")) {
    if (typeof body.is_available !== "boolean") throw new HttpError(422, "invalid_input", "is_available must be true or false");
    out.is_available = body.is_available;
  }
  if (has("stock_quantity")) {
    const q = body.stock_quantity;
    if (q === null) out.stock_quantity = null; // null = don't track stock for this product
    else if (typeof q === "number" && Number.isInteger(q) && q >= 0 && q <= 1_000_000) out.stock_quantity = q;
    else throw new HttpError(422, "invalid_input", "Stock must be a whole number, or empty to stop tracking");
  }
  if (has("images")) {
    if (!Array.isArray(body.images) || body.images.length > MAX_IMAGES) {
      throw new HttpError(422, "invalid_input", `Add up to ${MAX_IMAGES} images`);
    }
    out.images = body.images.map((raw, i) => {
      const r = (typeof raw === "string" ? { url: raw } : raw) as Record<string, unknown> | null;
      if (!r || typeof r !== "object") throw new HttpError(422, "invalid_input", `Image ${i + 1} is not valid`);
      const url = cleanHttpsUrl(r.url, `Image ${i + 1}`);
      if (url === null) throw new HttpError(422, "invalid_input", `Image ${i + 1} needs a web address`);
      return { url, alt_text: cleanText(r.alt_text, "Image description", 125) };
    });
  }
  if (Object.keys(out).length === 0) throw new HttpError(422, "nothing_to_update", "No changes were sent");
  return out;
}
