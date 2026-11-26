/**
 * Brand + site-wide constants. The product name is still being decided (SellSharp / ShopOga),
 * so everything that mentions it should read from here.
 */
const rawUrl = import.meta.env.VITE_SITE_URL ?? "https://sellsharp.ng";

export const SITE = {
  name: "Sellsharp",
  url: rawUrl.replace(/\/+$/, ""),
  locale: "en_NG",
  country: "NG",
  tagline: "Connecting Sellers. Powering Possibilities.",
  description:
    "Sellsharp gives Nigerian WhatsApp vendors a shareable online store, order dashboard, receipts and debt tracker. Plans from ₦100 a month.",
  ogImage: "/logo-full.jpg",
  ogImageAlt: "Sellsharp — Connecting Sellers. Powering Possibilities.",
  monthlyPriceKobo: 10_000,
} as const;

export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}
