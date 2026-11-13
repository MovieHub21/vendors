# SellSharp web (marketing site · vendor accounts · SEO & vendor storefronts)

Vite · React 18 · TypeScript · React Router 6 · Tailwind 3 (mapped to theme variables) · Supabase (SQL + Edge Functions) · Cloudflare Pages Worker · Vitest

## Commands

| Command                              | What it does                                                                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                        | Local dev server (vendor pages use demo data unless Supabase is configured)                                                      |
| `npm run build`                      | Type-check, build the app, the server renderer and `dist/_worker.js`, then prerender the marketing pages, sitemap and robots.txt |
| `npm run smoke`                      | After a build: runs the **built Worker** against fake Supabase data and checks the real HTML, statuses and sitemaps              |
| `npm run check`                      | Lint + type-check + tests + build (run before every commit)                                                                      |
| `npm test`                           | Vitest: routes, SEO output, server-rendered HTML, SQL on a real Postgres engine, edge-function logic, hydration                  |
| `npm run db:bundle`                  | Rebuild `supabase/setup.sql` from `supabase/migrations/`                                                                         |
| `npm run lint` / `format` / `assets` | ESLint / Prettier / regenerate `public/` brand images                                                                            |

Copy `.env.example` to `.env` (site URL + Supabase URL and **publishable** key). **Backend setup (SQL, edge functions, Paystack) is in [`supabase/README.md`](supabase/README.md).**

## How pages are rendered (the SEO architecture)

I inspected the existing app and kept it. The browser app (Vite/React) still powers the dashboard and in-app navigation. Public pages are served as real HTML in two ways:

| Pages                                                   | How                                                                                                                                                                 | When                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| SellSharp marketing pages                               | **Prerendered** at build time into static files with their own title, description, canonical, Open Graph and JSON-LD                                                | `npm run build`               |
| Vendor stores, products, product lists, store directory | **Server-rendered on request** by the Worker (`src/edge/`), using the _same React components_ and data from the public database views, then hydrated in the browser | every request (cached ~5 min) |
| Dashboard, onboarding, login                            | Browser app (private, `noindex`)                                                                                                                                    | n/a                           |

Why not only client-side React? WhatsApp, Facebook and X read link previews **without running JavaScript**, and Google may index slowly or incompletely a page that needs JavaScript to show its content. So the first HTML response for `/ama-hairs` and `/ama-hairs/products/body-wave-wig` already contains the title, meta description, canonical URL, Open Graph/Twitter tags, JSON-LD, `<h1>`, product images (with alt text), prices and links. The server decides the HTTP status (200 / 301 / 404 / 503) and everyone, crawlers and people alike, gets the same answer. `src/edge/handler.ts` is a portable `Request → Response` function; `src/edge/worker.ts` is its Cloudflare entry. Moving to Next.js later is possible, but nothing here needs it.

### Deploying on Vercel

1. Import the repository in your Vercel Dashboard.
2. Framework Preset: **Vite** (or Other). Build command: `npm run build`, output directory: `dist`.
3. **Environment variables** in Vercel project settings:
   - `VITE_SITE_URL`: your public URL (e.g. `https://sellsharp.ng` or your vercel subdomain)
   - `VITE_SUPABASE_URL`: your Supabase project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: your Supabase publishable key
4. Deploy! `vercel.json` handles static routing, asset caching, security headers, and SPA routing rewrites.

## URLs

| URL                                                                              | Page                     | Indexable?                                   |
| -------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------- |
| `/`, `/features`, `/pricing`, `/faq`, `/contact`, `/about`, `/terms`, `/privacy` | Marketing                | yes                                          |
| `/{store}`                                                                       | Vendor storefront        | when the store is eligible                   |
| `/{store}/products`                                                              | All the store's products | when the store is eligible                   |
| `/{store}/products/{product}`                                                    | Product page             | when the product is eligible                 |
| `/{store}/about`                                                                 | Store about              | no (thin by nature)                          |
| `/stores`, `/stores/{category-or-location}`                                      | Directory                | yes; landing pages only with ≥ 3 real stores |
| `/dashboard`, `/dashboard/{sale,orders,customers,products,seo,receipt/:orderId}`, `/onboarding`, `/login`, `/signup`, … | Private                  | never (`noindex` + robots + server header)   |

Rules: lowercase, hyphens, one URL per page (trailing slash and uppercase are 301-redirected). Unknown or hidden pages return a **real 404**. A renamed product 301-redirects from its old URL (database trigger + `public_product_redirects`). Store usernames can't be changed after creation (that would break every shared link), so there are no store redirects. `/{store}/contact` is not built: it would publish vendor contact details that vendors haven't opted in to share.

## Indexing eligibility (decided once, in the database)

`supabase/migrations/…0500_seo.sql` holds the rules; the website, sitemaps and dashboard all read the same verdict.

- **Store indexable** = published (active subscription) · not suspended · vendor allows indexing · description ≥ 30 characters · category · location · **≥ 1 eligible product**. Incomplete or empty stores still open for people but are `noindex` and left out of sitemaps.
- **Product indexable** = published (not draft/archived) · name · description ≥ 20 characters · **≥ 1 image** · vendor allows indexing · store published and active. Out-of-stock products stay indexable with accurate availability.
- Only views expose public data (`public_stores`, `public_products`, `sitemap_*`, …) and they never include owner ids, phone numbers, emails or stock counts. Tests assert it.

## Sitemaps and robots.txt

`/sitemap.xml` is a sitemap **index** generated on request: `/sitemaps/platform.xml` (marketing pages, built), `/sitemaps/stores.xml` (indexable stores + qualifying directory pages), `/sitemaps/products-N.xml` (10,000 products each). New stores and products appear automatically (cached ≤ 15 min). `lastmod` follows real edits. `robots.txt` disallows the dashboard, onboarding, login/registration, checkout, admin and account areas and lists the sitemap. Robots.txt is not security: private pages also carry `noindex` and sit behind a login.

## Social sharing and link previews

- **Share / Copy link** on every store and product page. The link is built from the canonical path and the production origin (never `window.location`), so it's never localhost or staging. "Copied" is shown only after the browser confirms it; if clipboard access is denied the link is shown to copy by hand. The native share sheet (WhatsApp, Messages…) is used where the browser supports it.
- **Preview metadata** is in the first HTML response: `og:type` (`product` for products), title (product name + vendor), description, `og:url` (= canonical), `og:image` + `secure_url` + width/height, `og:site_name`, price amount/currency/availability for products, and Twitter card tags. Images are absolute public `https` URLs; signed/expiring/localhost/`http` URLs are rejected and fall back in this order: **product** — product social image → gallery → store social image → store logo → SellSharp default; **store** — social image → banner → logo → default.
- **Product ↔ vendor mapping:** the product URL carries both slugs, and the database looks a product up _by store slug and product slug together_. The same slug under another vendor shows that vendor's product; a product under the wrong store path is a 404.
- **Refreshing a preview after changing it:** apps cache previews. Facebook/Instagram: Meta's _Sharing Debugger_ → "Scrape Again". Telegram: the `@WebpageBot` bot. LinkedIn: _Post Inspector_. WhatsApp has no public debugger and caches for a while, so re-share after some time. Don't add `?v=2` style parameters (the canonical URL stays clean).

## Vendor SEO dashboard

`/dashboard/seo` (Store SEO): editable SEO title and description with live length checks, optional keywords (shown as guidance only; Google doesn't rank on them), social image address, an indexing on/off switch, the public URL with Copy, a Google-style result preview and a link-card preview (illustrations only), and a status list that keeps four things separate: **published**, **eligible for indexing**, **discoverable via the sitemap**, and **actually indexed by Google** (unknowable here, so it points to Search Console). Saves go through the `update-store-seo` edge function, which only ever edits the caller's own store, strips/refuses markup, enforces limits and https images, and ignores ids, status and slug.

## Vendor dashboard and sales

Built on the existing architecture: the browser **reads** its own rows under Row Level Security, and every **write** goes through an edge function that takes the store from the login (never from the request) and calls a Postgres function that decides the numbers.

| Screen | What it does |
| --- | --- |
| `/dashboard` | Sales total / today / this month, pending orders, awaiting delivery, who owes you, low stock, recent orders and payments, shortcuts (record sale, add product, orders, customers, debts, share store) |
| `/dashboard/sale` | Record a sale from WhatsApp, Instagram, Facebook, walk-in or other. Existing or new customer, catalogue or custom items, optional price override, amount paid, method, note. The balance is shown live and recomputed by the server |
| `/dashboard/orders` | Search (reference, customer, phone), filter by status, payment status and date; order detail with items, payments, status changes, record payment, receipt, WhatsApp message |
| `/dashboard/customers` | Customer list with orders, purchases, paid, owing and last purchase; "Owing money" view; profile with purchase history, record payment, WhatsApp balance reminder |
| `/dashboard/products` | Add, edit, duplicate, hide/show, delete; stock; pictures (https links); search and filters; WhatsApp share with a prepared message |
| `/dashboard/receipt/:orderId` | Preview, print / save as PDF, share as WhatsApp text. A new version is issued when payments change; earlier versions are kept |
| Product page `/{store}/products/{product}` | Guest checkout (name, phone, optional email/address/note). Creates a **pending** order; shows a confirmation and a WhatsApp link to the seller |

Rules (database, `supabase/migrations/…0600_sales.sql`, tested in `supabase/tests/sales-db.test.ts`):

- A **sale** is an order that is not `pending` and not `cancelled`. Totals, sales figures, debts and customer totals count sales only.
- **Stock** is reduced once, when an order becomes a sale (recorded sale, or a pending order confirmed), and restored if that sale is cancelled. Pending, failed or never-confirmed orders never change stock. Overselling is refused and rolls the whole sale back.
- **Prices** at storefront checkout always come from the database. Vendors may override a price only on a manual sale.
- **Payments** are rows in `order_payments`; paid amount and payment status are derived by the database. Manual payments (`source = manual`) can never be recorded as Paystack payments (constraint). Overpayment is refused.
- **Customers** are matched by phone number within one vendor (`0803…`, `+234803…` and `234803…` match). Customers without a phone are never merged.
- **Receipts** are immutable snapshots; per-store numbering (`RC-000001`).
- If a subscription lapses, vendors can still view records and open receipts; creating or changing records needs an active subscription. Nothing is deleted.

## Security

SEO text is plain text only (`<`/`>` rejected by the edge function and by database constraints); React and the head renderer escape everything; JSON-LD is generated by the server (vendors can't inject their own) and `<` is escaped inside it; the page-data blob in the HTML is escaped too. Public-data slugs are validated before they touch a query. Tests cover script/markup injection, `$&` replacement patterns, cross-vendor isolation, row-level security and private-column leaks.

## Google Search Console (do once, after launch)

1. Search Console → **Add property → Domain** → `sellsharp.ng` → add the TXT record at your DNS host → Verify.
2. **Sitemaps** → submit `https://sellsharp.ng/sitemap.xml`. Expect "Success" and per-file counts.
3. **URL Inspection** → test the home page, one store and one product. Check "Page is indexable", the canonical, and _View crawled page → HTML_ (it should contain the content).
4. Test structured data with Google's **Rich Results Test** and the **Schema Markup Validator**.
5. Watch **Pages** (indexing + exclusions), **Performance** (queries, clicks, impressions) and **Core Web Vitals**. Vendors don't need accounts; SellSharp manages this centrally.

## Status against the SEO specification

| Area                                                                                      | Status                                                                                                                               |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Platform SEO: unique titles/descriptions, canonical, OG/Twitter, JSON-LD, sitemap, robots | **Done**, tested                                                                                                                     |
| Server-rendered vendor storefronts and products (crawler-readable HTML, real statuses)    | **Done**, tested on the built Worker (`npm run smoke`)                                                                               |
| Store SEO fields, generated defaults, vendor editor, eligibility, status                  | **Done**                                                                                                                             |
| Product SEO fields, `/products/` URLs, structured data, redirects, eligibility            | **Done** in database, rendering and sitemaps. Product _creation_ screens come with the products dashboard                            |
| Sitemap index (platform/stores/products)                                                  | **Done**                                                                                                                             |
| Directory, category and location pages with thin-page protection                          | **Done** (locations: state or city from vendors' own data)                                                                           |
| Share/copy link, native share, product-specific previews                                  | **Done**                                                                                                                             |
| Security and vendor isolation (RLS, validation, sanitising)                               | **Done**, tested on real Postgres                                                                                                    |
| Real WhatsApp / Facebook / X previews, Search Console, Rich Results Test                  | **You must verify on the live domain** (can't be done from a build). Checklist above                                                 |
| Core Web Vitals measurement                                                               | After launch, in Search Console / PageSpeed Insights. Images have dimensions, lazy loading and priority hints; fonts are self-hosted |
| GA4 analytics                                                                             | **Not built.** It needs a consent banner and a measurement ID first (Nigeria Data Protection Act); add it after those decisions      |
| Super-admin SEO controls (suspend, review incomplete stores, edit with audit trail)       | **Not built** (Phase 5). The database already honours `status = suspended` everywhere                                                |
| `/blog`, `/dashboard/store-settings`, `/{store}/contact`                                  | **Not built**                                                                                                                        |
| Photo upload (Supabase Storage) for logos, banners, product images                        | **Not built.** Vendors paste public image addresses for now; WebP/AVIF resizing needs Storage image transformations                  |
| Real products                                                                             | The demo stores/products only appear in local development, are always `noindex` and are never served by the Worker                   |

## Structure

```
src/
  App.tsx · layouts/ · pages/ · pages/public/ (store, product, directory views) · components/
  edge/        handler.ts (Request→Response SSR), sitemaps.ts, worker.ts (Cloudflare entry)
  ssr/         pageData.ts (URL → data + HTTP status, shared by server and browser)
  data/        publicApi.ts (reads the public views), pageMeta, FAQs, features, demo data
  lib/         seo.ts (all metadata + JSON-LD), routes, reserved slugs, theme, money, share
  styles/ · hooks/ · auth/ · services/ (auth + edge-function client)
supabase/      migrations/ · setup.sql · functions/ · tests/
```

## Day / night theme

Light 06:00–18:30 local time, dark otherwise (`src/lib/themeConfig.ts`), painted before first paint, re-checked while the tab is open, with an Auto / Light / Dark button. Dark panels (`.section-dark`, `.footer`, `.store-cover`) keep their palette in both themes.

## Roadmap

| Phase                                                             | Status                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1 Marketing site                                                  | Done                                                             |
| 2 Vendor auth, onboarding, Paystack subscription                  | Done in code. Needs your Supabase project + Paystack keys        |
| SEO MVP (A–D)                                                     | Done in code, see the table above. Phase E needs the live domain |
| 3 Vendor dashboard (products, orders, customers, receipts, debts) | In code (see "Vendor dashboard and sales" below); needs migration 0600 + deploy |
| 4 Customer checkout                                               | Guest checkout for one product at a time, in code; no online payment yet |
| 5 Super-admin · 6 backend hardening · 7 QA/launch                 | Not started                                                      |
