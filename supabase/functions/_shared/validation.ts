/** Input validation for the store endpoints. Pure, so it is unit-tested in Node. */
import { HttpError } from "./http.ts";

export const SLUG_MIN = 3;
export const SLUG_MAX = 30;

/** Cheap format check so obviously bad input never reaches the database. Reserved words are checked in Postgres. */
export function slugFormatProblem(raw: unknown): "too_short" | "too_long" | "invalid_characters" | null {
  const slug = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (slug.length < SLUG_MIN) return "too_short";
  if (slug.length > SLUG_MAX) return "too_long";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "invalid_characters";
  return null;
}

export const normaliseSlug = (raw: unknown): string => (typeof raw === "string" ? raw.trim().toLowerCase() : "");

export interface StoreInput {
  name: string;
  slug: string;
  category: string;
  city: string | null;
  state: string | null;
}

function text(value: unknown, field: string, min: number, max: number, required: boolean): string | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new HttpError(422, "invalid_input", `${field} is required`);
    return null;
  }
  if (typeof value !== "string") throw new HttpError(422, "invalid_input", `${field} must be text`);
  const v = value.replace(/\s+/g, " ").trim();
  if (v.length < min || v.length > max) {
    throw new HttpError(422, "invalid_input", `${field} must be ${min}–${max} characters`);
  }
  return v;
}

export function parseStoreInput(body: Record<string, unknown>): StoreInput {
  const problem = slugFormatProblem(body.slug);
  if (problem) throw new HttpError(422, "invalid_slug", problem);
  return {
    name: text(body.name, "name", 2, 80, true)!,
    slug: normaliseSlug(body.slug),
    category: text(body.category, "category", 2, 40, true)!,
    city: text(body.city, "city", 2, 60, false),
    state: text(body.state, "state", 2, 40, false),
  };
}
