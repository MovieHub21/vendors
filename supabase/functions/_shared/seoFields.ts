/**
 * Validation + sanitising for vendor-editable SEO fields. Pure, so it is unit-tested in Node.
 * Rules: plain text only (no < or >), hard length limits, https social images, and never trust an id from the client.
 */
import { HttpError } from "./http.ts";

const MARKUP = /[<>]/;
// deno-lint-ignore no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/g;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

/** "" / null mean "clear it" (the website then falls back to the automatically generated text). */
export function cleanText(value: unknown, field: string, max: number, min = 0): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new HttpError(422, "invalid_input", `${field} must be text`);
  const v = value.replace(CONTROL, " ").replace(/\s+/g, " ").trim();
  if (v === "") return null;
  if (MARKUP.test(v)) throw new HttpError(422, "invalid_input", `${field} cannot contain < or >`);
  if (v.length > max) throw new HttpError(422, "invalid_input", `${field} must be ${max} characters or fewer`);
  if (v.length < min) throw new HttpError(422, "invalid_input", `${field} must be at least ${min} characters`);
  return v;
}

export function cleanHttpsUrl(value: unknown, field: string): string | null {
  const v = cleanText(value, field, 500);
  if (v === null) return null;
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    throw new HttpError(422, "invalid_input", `${field} must be a valid web address`);
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    host === "localhost" ||
    host.endsWith(".local") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    host === "[::1]"
  ) {
    throw new HttpError(422, "invalid_input", `${field} must be a public https address`);
  }
  return url.toString();
}

export interface StoreSeoUpdate {
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  og_image_url?: string | null;
  indexable?: boolean;
  category?: string;
  city?: string | null;
  state?: string | null;
  tagline?: string | null;
  description?: string;
  contact_phone?: string | null;
  contact_email?: string | null;
  cover_url?: string | null;
  storefront_layout?: "editorial" | "classic" | "minimal" | "showcase";
  hero_eyebrow?: string | null;
  hero_title?: string | null;
  hero_description?: string | null;
  hero_button_text?: string | null;
  category_heading?: string | null;
  products_heading?: string | null;
  promo_one_title?: string | null;
  promo_one_text?: string | null;
  promo_one_image_url?: string | null;
  promo_two_title?: string | null;
  promo_two_text?: string | null;
  promo_two_image_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  tiktok_url?: string | null;
  youtube_url?: string | null;
  x_url?: string | null;
  threads_url?: string | null;
  snapchat_url?: string | null;
  pinterest_url?: string | null;
  linkedin_url?: string | null;
  other_social_label?: string | null;
  other_social_url?: string | null;
}

export function cleanPhone(value: unknown, field = "phone"): string | null {
  const v = cleanText(value, field, 20);
  if (v !== null && !PHONE.test(v)) throw new HttpError(422, "invalid_input", `${field} must be a valid phone number`);
  return v;
}

/** Only keys present in the request are updated, so one form field can be saved without touching the others. */
export function parseStoreSeoUpdate(body: Record<string, unknown>): StoreSeoUpdate {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const out: StoreSeoUpdate = {};

  if (has("seo_title")) out.seo_title = cleanText(body.seo_title, "SEO title", 60);
  if (has("seo_description")) out.seo_description = cleanText(body.seo_description, "SEO description", 160);
  if (has("seo_keywords")) out.seo_keywords = cleanText(body.seo_keywords, "Keywords", 200);
  if (has("og_image_url")) out.og_image_url = cleanHttpsUrl(body.og_image_url, "Social sharing image");
  if (has("cover_url")) out.cover_url = cleanHttpsUrl(body.cover_url, "Store banner");
  if (has("storefront_layout")) {
    const layout = body.storefront_layout;
    if (layout !== "editorial" && layout !== "classic" && layout !== "minimal" && layout !== "showcase") {
      throw new HttpError(422, "invalid_input", "Choose a supported storefront layout");
    }
    out.storefront_layout = layout;
  }
  if (has("hero_eyebrow")) out.hero_eyebrow = cleanText(body.hero_eyebrow, "Hero eyebrow", 50);
  if (has("hero_title")) out.hero_title = cleanText(body.hero_title, "Hero title", 90);
  if (has("hero_description")) out.hero_description = cleanText(body.hero_description, "Hero description", 200);
  if (has("hero_button_text")) out.hero_button_text = cleanText(body.hero_button_text, "Hero button text", 32);
  if (has("category_heading")) out.category_heading = cleanText(body.category_heading, "Category heading", 50);
  if (has("products_heading")) out.products_heading = cleanText(body.products_heading, "Products heading", 60);
  if (has("promo_one_title")) out.promo_one_title = cleanText(body.promo_one_title, "First promotion title", 60);
  if (has("promo_one_text")) out.promo_one_text = cleanText(body.promo_one_text, "First promotion text", 140);
  if (has("promo_one_image_url")) out.promo_one_image_url = cleanHttpsUrl(body.promo_one_image_url, "First promotion image");
  if (has("promo_two_title")) out.promo_two_title = cleanText(body.promo_two_title, "Second promotion title", 60);
  if (has("promo_two_text")) out.promo_two_text = cleanText(body.promo_two_text, "Second promotion text", 140);
  if (has("promo_two_image_url")) out.promo_two_image_url = cleanHttpsUrl(body.promo_two_image_url, "Second promotion image");
  for (const field of ["facebook_url", "instagram_url", "tiktok_url", "youtube_url", "x_url", "threads_url", "snapchat_url", "pinterest_url", "linkedin_url"] as const) {
    if (has(field)) out[field] = cleanHttpsUrl(body[field], field.replace(/_url$/, " link"));
  }
  if (has("other_social_label")) out.other_social_label = cleanText(body.other_social_label, "Other social link label", 32);
  if (has("other_social_url")) out.other_social_url = cleanHttpsUrl(body.other_social_url, "Other social link");
  if (has("tagline")) out.tagline = cleanText(body.tagline, "Tagline", 100);
  if (has("city")) out.city = cleanText(body.city, "City", 60, 2);
  if (has("state")) out.state = cleanText(body.state, "State", 40, 2);
  if (has("contact_phone")) out.contact_phone = cleanPhone(body.contact_phone, "Phone");
  if (has("contact_email")) {
    const e = cleanText(body.contact_email, "Email", 120);
    if (e !== null && !EMAIL.test(e)) throw new HttpError(422, "invalid_input", "Email must be a valid address");
    out.contact_email = e;
  }
  if (has("category")) {
    const c = cleanText(body.category, "Category", 40, 2);
    if (c === null) throw new HttpError(422, "invalid_input", "Category is required");
    out.category = c;
  }
  if (has("description")) out.description = cleanText(body.description, "Description", 1000) ?? "";
  if (has("indexable")) {
    if (typeof body.indexable !== "boolean")
      throw new HttpError(422, "invalid_input", "indexable must be true or false");
    out.indexable = body.indexable;
  }
  if (Object.keys(out).length === 0) throw new HttpError(422, "nothing_to_update", "No changes were sent");
  return out;
}
