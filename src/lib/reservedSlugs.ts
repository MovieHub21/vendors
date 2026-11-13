import { ALL_STATIC_ROUTES } from "./routes";

/**
 * A vendor's store lives at /{slug}, so a slug must never collide with a real route or a word we may need later.
 * Every first segment of ALL_STATIC_ROUTES is reserved automatically; the list below covers future areas.
 */
const FUTURE_AND_SYSTEM = [
  "app",
  "dashboard",
  "admin",
  "api",
  "auth",
  "onboarding",
  "billing",
  "settings",
  "account",
  "checkout",
  "cart",
  "order",
  "orders",
  "receipt",
  "receipts",
  "customers",
  "products",
  "debts",
  "reports",
  "store",
  "stores",
  "shop",
  "shops",
  "vendor",
  "vendors",
  "reset-password",
  "verify-email",
  "www",
  "mail",
  "support",
  "help",
  "status",
  "blog",
  "docs",
  "legal",
  "security",
  "sitemap",
  "robots",
  "assets",
  "static",
  "public",
  "cdn",
  "sellsharp",
  "shopoga",
  "payment",
  "payments",
  "webhook",
  "webhooks",
  "paystack",
  "null",
  "undefined",
<<<<<<< HEAD
  "sitemaps",
  "search",
  "category",
  "categories",
  "location",
  "locations",
  "directory",
  "ssr-template",
  "app-shell",
=======
>>>>>>> fff1e204ef1fae4241e0315519c70051791e632c
];

const fromRoutes = ALL_STATIC_ROUTES.map((r) => r.split("/")[1]).filter(Boolean);

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([...fromRoutes, ...FUTURE_AND_SYSTEM]);

export type SlugProblem = "too_short" | "too_long" | "invalid_characters" | "reserved";
export type SlugCheck = { ok: true; slug: string } | { ok: false; reason: SlugProblem };

export const SLUG_MIN = 3;
export const SLUG_MAX = 30;

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/** "Ama's Hair Studio!" -> "amas-hair-studio". Output is not guaranteed valid: run it through validateStoreSlug. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Format + reserved-word rules. Uniqueness is a database concern (unique index on stores.slug). */
export function validateStoreSlug(input: string): SlugCheck {
  const slug = input.trim().toLowerCase();
  if (slug.length < SLUG_MIN) return { ok: false, reason: "too_short" };
  if (slug.length > SLUG_MAX) return { ok: false, reason: "too_long" };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { ok: false, reason: "invalid_characters" };
  if (isReservedSlug(slug)) return { ok: false, reason: "reserved" };
  return { ok: true, slug };
}
