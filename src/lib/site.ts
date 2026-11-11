/**
 * Brand + site-wide constants. The product name is still being decided (SellSharp / ShopOga),
 * so everything that mentions it should read from here.
 */
const rawUrl = import.meta.env.VITE_SITE_URL ?? "https://sellsharp.ng";

export const SITE = {
  name: "SellSharp",
  url: rawUrl.replace(/\/+$/, ""),
  locale: "en_NG",
  country: "NG",
  tagline: "Your business, in better order.",
  description:
    "SellSharp gives Nigerian WhatsApp vendors a shareable online store, order dashboard, receipts and debt tracker. Plans from ₦3,000 a month.",
  ogImage: "/og-default.png",
  ogImageAlt: "SellSharp — online store and order manager for Nigerian vendors",
  monthlyPriceKobo: 300_000,
} as const;

export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}
