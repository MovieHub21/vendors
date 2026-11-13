# SellSharp backend (Supabase)

**Database** = SQL files you paste into the Supabase SQL Editor. **API** = Edge Functions. The browser only _reads_ its own rows (protected by Row Level Security); every write goes through an edge function.

```
supabase/
  setup.sql              ← ALL migrations in one file (paste this into the SQL Editor)
  migrations/            ← the same SQL, one file per topic (edit these, then run `npm run db:bundle`)
  functions/             ← Edge Functions (Deno/TypeScript)
  config.toml            ← function settings (the webhook skips JWT; it uses Paystack's signature)
  tests/                 ← run the SQL on a real Postgres engine + unit-test the function logic
```

## 1. Create the database (5 minutes)

1. Supabase dashboard → **SQL Editor → New query**.
2. Paste the whole of **`supabase/setup.sql`** and click **Run**. It is safe to run again.
3. Check **Table Editor**: you should see `profiles`, `stores`, `subscription_plans`, `subscriptions`, `payments`, `webhook_events`, `reserved_slugs`, `products`, `product_images`, `customers`, `orders`, `order_items`, `order_payments`, `receipts`.

(Prefer the CLI? `supabase link --project-ref <ref>` then `supabase db push` applies `migrations/` instead.)

Optional, once: **Database → Extensions → enable `pg_cron`**, then run the commented `cron.schedule(...)` line at the bottom of `migrations/…0400_billing.sql`. It takes stores offline when a subscription lapses.

## 2. Configure Auth

Dashboard → **Authentication**:

- **URL Configuration → Site URL**: your site, e.g. `https://sellsharp.ng` (use `http://localhost:5173` while developing).
- **Redirect URLs**: add `https://sellsharp.ng/**` and `http://localhost:5173/**`.
- **Providers → Email**: keep _Confirm email_ **on** (recommended). The app handles both settings.
- **SMTP**: Supabase's built-in email sender is heavily rate-limited. Add your own SMTP provider before launch or vendors won't receive confirmation/reset emails reliably.

## 3. Deploy the edge functions

Install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), then from the project root:

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
cp supabase/functions/.env.example supabase/functions/.env      # fill in PAYSTACK_SECRET_KEY and SITE_URL
supabase secrets set --env-file supabase/functions/.env
supabase functions deploy me check-slug create-store update-store-seo subscription-initialize subscription-verify paystack-webhook
```

`SUPABASE_URL` and the Supabase keys are injected automatically. Never put the secret key in the website's `.env`.

## 4. Paystack

1. Paystack dashboard → **Settings → API Keys & Webhooks** (stay in **Test mode** at first).
2. Set the **Test Webhook URL** to `https://YOUR-PROJECT-REF.supabase.co/functions/v1/paystack-webhook`.
3. Put the test secret key in `PAYSTACK_SECRET_KEY` (step 3).
4. Try a payment with Paystack's [test cards](https://paystack.com/docs/payments/test-payments/). The store should go live. Go live later by swapping in the live key and live webhook URL.

_Automatic monthly renewal (optional):_ create a Plan in Paystack for ₦3,000/month, then `supabase secrets set PAYSTACK_PLAN_CODE=PLN_xxx`. Without it, vendors pay each month and the period is extended by 30 days.

## 5. Connect the website

Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API). Run `npm run dev`.

## The API

All functions need `Authorization: Bearer <user session token>` (the website adds it) except the webhook.

| Function                  | Does                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `me`                      | Profile, store, subscription and the vendor's `next_step` (`create_store` → `subscribe` → `done`) |
| `check-slug`              | `{slug}` → is this store username free? Format, reserved words and uniqueness                     |
| `create-store`            | `{name, slug, category, state?, city?}` → creates the vendor's store (one per vendor)             |
| `subscription-initialize` | Starts a Paystack checkout for the plan; the price comes from the database                        |
| `subscription-verify`     | `{reference}` → confirms the payment with Paystack (used on the return page)                      |
| `paystack-webhook`        | Paystack → us. Signature-checked, re-verified, idempotent                                         |

## Security model

- **Row Level Security** on every table. Browsers can `select` their own rows only; there are no insert/update/delete policies, and those privileges are also revoked. The public sees only `public_stores` (published, active stores; never the owner id).
- **The service/secret key lives only in edge-function secrets.** The website uses the publishable key.
- **Payments are never trusted from the browser or the webhook body.** Every confirmation is re-checked with Paystack's API, then Postgres compares the amount and currency to the stored payment _and_ the plan price (`apply_successful_payment`). Applying the same reference twice changes nothing.
- **Webhook signature** (HMAC-SHA512, constant-time) is required; every delivery is logged once in `webhook_events`.
- **Store usernames** are enforced in the database (format, reserved words, unique, frozen after creation), so no client or function bug can create a bad one.
- **CORS** only allows `SITE_URL`, localhost and `ALLOWED_ORIGINS`.
- **Not built yet** (add before heavy traffic): per-user rate limits on the functions, and a support flow for refunds.

## Public data and the website's server renderer

Public pages read the **public views** (`public_stores`, `public_products`, `public_product_redirects`, `sitemap_stores`, `sitemap_products`, `public_directory_*`) through Supabase's REST API with the **publishable** key. These views are the only public surface; the tables themselves stay private. The eligibility rules (which stores/products may be indexed) live in `migrations/…0500_seo.sql`, in the `private` schema, so the Data API cannot call them. Re-running a migration is safe.

## Tests

`npm test` runs the migrations on PGlite (a real Postgres engine) to prove the constraints, Row Level Security, privileges and the payment function, and unit-tests the function logic (validation, webhook signature, payment confirmation). The function files themselves are type-checked with Deno (`deno check supabase/functions/*/index.ts`).

## Sales functions (added with migration 0600)

Deploy with `supabase functions deploy <name>`. All need a login except `place-order` (guest checkout, `verify_jwt = false` in `config.toml`; it accepts no prices or payment status).

| Function | Purpose |
| --- | --- |
| `place-order` | Public checkout: creates a **pending** order priced from the database |
| `record-sale` | Vendor: sale from WhatsApp / walk-in / etc., with payment and stock |
| `update-order-status` | Vendor: move an order along; stock follows the status |
| `record-payment` | Vendor: manual payment against an order (cannot exceed the balance) |
| `order-receipt` | Vendor: create or re-issue a receipt |
| `dashboard-summary` | Vendor: dashboard figures, computed in Postgres |
| `save-product`, `product-action` | Vendor: add/edit products; duplicate, hide/show, delete |
