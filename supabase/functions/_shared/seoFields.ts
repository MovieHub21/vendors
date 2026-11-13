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
