// @vitest-environment node
/**
 * Orders, sales, payments, stock, receipts and dashboard figures, run on a real Postgres engine (PGlite).
 * These are the rules vendors depend on, so they are tested where they are enforced: in the database.
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = path.resolve(__dirname, "../migrations");
const migrations = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => fs.readFileSync(path.join(dir, f), "utf8"));

const STUBS = `
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

let db: PGlite;
const owner: Record<string, string> = {};
const store: Record<string, string> = {};
const product: Record<string, string> = {};

const as = async (role: "anon" | "authenticated" | "service_role", uid = "") =>
  db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${uid}',false);`);
const reset = async () => db.exec(`reset role;`);
const err = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  return null;
};

/** Calls a function the way an edge function does (service role), then goes back to the superuser. */
async function svc<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  await as("service_role");
  try {
    const { rows } = await db.query<{ r: T }>(`select ${sql} as r`, params);
    return rows[0].r;
  } finally {
    await reset();
  }
}
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows[0];
const stock = async (id: string) => (await one<{ s: number | null }>(`select stock_quantity as s from public.products where id=$1`, [id])).s;

const sale = (s: string, o: { cid?: string | null; customer?: unknown; items: unknown; paid?: number; method?: string | null }) =>
  svc(`public.record_sale($1,$2,$3::jsonb,$4::jsonb,'whatsapp',$5,$6,null)`, [
    s,
    o.cid ?? null,
    JSON.stringify(o.customer ?? null),
    JSON.stringify(o.items),
    o.paid ?? 0,
    o.method ?? null,
  ]);
const checkout = (slug: string, items: unknown, phone = "08031112222") =>
  svc(`public.place_store_order($1,$2::jsonb,$3::jsonb,'please call first','12 Allen Ave')`, [
    slug,
    JSON.stringify({ name: "Ngozi Eze", phone }),
    JSON.stringify(items),
  ]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  for (const sql of migrations) await db.exec(sql);
  await db.exec(`insert into auth.users (email) values ('a@example.com'), ('b@example.com');`);
  const users = await db.query<{ id: string; email: string }>(`select id, email from auth.users order by email`);
  owner.a = users.rows[0].id;
  owner.b = users.rows[1].id;
  for (const k of ["a", "b"] as const) {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.stores (owner_id, name, slug, category, is_published, contact_phone)
       values ($1, $2, $3, 'Fashion', true, '08011112222') returning id`,
      [owner[k], `Shop ${k.toUpperCase()}`, `shop-${k}`],
    );
    store[k] = rows[0].id;
  }
  const add = async (key: string, s: string, name: string, slug: string, price: number, qty: number | null, extra = "published") => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.products (store_id, name, slug, price_kobo, stock_quantity, status) values ($1,$2,$3,$4,$5,$6) returning id`,
      [s, name, slug, price, qty, extra],
    );
    product[key] = rows[0].id;
  };
  await add("bag", store.a, "Leather bag", "leather-bag", 2_500_000, 10);
  await add("shoe", store.a, "Sneakers", "sneakers", 3_000_000, 2);
  await add("untracked", store.a, "Gift wrap", "gift-wrap", 100_000, null);
  await add("hidden", store.a, "Hidden item", "hidden-item", 100_000, 5, "archived");
  await add("other", store.b, "Other shop item", "other-item", 100_000, 5);
});
afterAll(() => db.close());

describe("migration", () => {
  it("can be run a second time without errors", async () => {
    for (const sql of migrations) await db.exec(sql);
  });
  it("normalises Nigerian phone numbers so returning customers match", async () => {
    for (const p of ["0801 234 5678", "+234 801 234 5678", "2348012345678", "(0801) 234-5678"]) {
      expect(await svc(`public.phone_key($1)`, [p])).toBe("08012345678");
    }
    expect(await svc(`public.phone_key($1)`, [""])).toBeNull();
  });
});

describe("recording a sale", () => {
  it("calculates the balance in the database, creates the customer and reduces stock", async () => {
    const r = (await sale(store.a, {
      customer: { name: "Chidi Obi", phone: "0801 234 5678" },
      items: [{ product_id: product.bag, quantity: 2 }, { product_id: product.shoe, quantity: 1, unit_price_kobo: 2_500_000 }],
      paid: 5_000_000,
      method: "bank_transfer",
    })) as { total_kobo: number; paid_kobo: number; outstanding_kobo: number; order_id: string };
    expect(r.total_kobo).toBe(7_500_000); // ₦75,000: bag 2 × ₦25,000 + sneakers at the vendor's own ₦25,000
    expect(r.paid_kobo).toBe(5_000_000);
    expect(r.outstanding_kobo).toBe(2_500_000);
    expect(await stock(product.bag)).toBe(8);
    expect(await stock(product.shoe)).toBe(1);
    const o = await one<{ payment_status: string; status: string; stock_applied: boolean }>(
      `select payment_status, status, stock_applied from public.orders where id=$1`,
      [r.order_id],
    );
    expect(o).toEqual({ payment_status: "partial", status: "confirmed", stock_applied: true });
  });

  it("matches a returning customer by phone within the same vendor, whatever the format", async () => {
    await sale(store.a, { customer: { name: "Someone typed differently", phone: "+2348012345678" }, items: [{ product_id: product.untracked, quantity: 1 }] });
    const n = await one<{ n: number }>(`select count(*)::int as n from public.customers where store_id=$1 and phone_key='08012345678'`, [store.a]);
    expect(n.n).toBe(1);
    expect((await one<{ name: string }>(`select name from public.customers where store_id=$1 and phone_key='08012345678'`, [store.a])).name).toBe("Chidi Obi");
  });

  it("keeps customers separate between vendors, even with the same phone number", async () => {
    await sale(store.b, { customer: { name: "Chidi at B", phone: "08012345678" }, items: [{ product_id: product.other, quantity: 1 }] });
    const n = await one<{ n: number }>(`select count(*)::int as n from public.customers where phone_key='08012345678'`);
    expect(n.n).toBe(2);
  });

  it("does not touch stock for products that aren't tracked", async () => {
    expect(await stock(product.untracked)).toBeNull();
  });

  it("refuses to oversell and leaves no half-saved order behind", async () => {
    const before = await one<{ n: number }>(`select count(*)::int as n from public.orders where store_id=$1`, [store.a]);
    const msg = await err(sale(store.a, { customer: { name: "X Y", phone: "08099990000" }, items: [{ product_id: product.shoe, quantity: 5 }] }));
    expect(msg).toMatch(/insufficient_stock/);
    const after = await one<{ n: number }>(`select count(*)::int as n from public.orders where store_id=$1`, [store.a]);
    expect(after.n).toBe(before.n);
    expect(await stock(product.shoe)).toBe(1);
  });

  it("rejects paying more than the total, and another vendor's products", async () => {
    expect(await err(sale(store.a, { customer: { name: "A B" }, items: [{ product_id: product.bag, quantity: 1 }], paid: 99_000_000, method: "cash" }))).toMatch(/invalid_payment/);
    expect(await err(sale(store.a, { customer: { name: "A B" }, items: [{ product_id: product.other, quantity: 1 }] }))).toMatch(/product_not_found/);
  });

  it("supports custom lines and customers without a phone number (never merged)", async () => {
    await sale(store.a, { customer: { name: "Walk In One" }, items: [{ name: "Alteration", quantity: 1, unit_price_kobo: 150_000 }], paid: 150_000, method: "cash" });
    await sale(store.a, { customer: { name: "Walk In One" }, items: [{ name: "Alteration", quantity: 1, unit_price_kobo: 150_000 }], paid: 150_000, method: "cash" });
    const n = await one<{ n: number }>(`select count(*)::int as n from public.customers where store_id=$1 and name='Walk In One'`, [store.a]);
    expect(n.n).toBe(2);
  });
});

describe("storefront checkout", () => {
  it("creates a PENDING order priced from the database, without touching stock or recording a payment", async () => {
    const before = await stock(product.bag);
    const r = (await checkout("shop-a", [{ product_id: product.bag, quantity: 2, unit_price_kobo: 1 }])) as { order_id: string; total_kobo: number; reference: string };
    expect(r.total_kobo).toBe(5_000_000); // the "price" the browser sent (1) is ignored
    expect(r.reference).toMatch(/^SS-[0-9A-F]{8}$/);
    expect(await stock(product.bag)).toBe(before);
    const o = await one<{ status: string; paid_kobo: number; payment_status: string; stock_applied: boolean }>(
      `select status, paid_kobo, payment_status, stock_applied from public.orders where id=$1`,
      [r.order_id],
    );
    expect(o).toEqual({ status: "pending", paid_kobo: 0, payment_status: "unpaid", stock_applied: false });
  });

  it("refuses hidden or unavailable products, products from another store, and unknown stores", async () => {
    expect(await err(checkout("shop-a", [{ product_id: product.hidden, quantity: 1 }]))).toMatch(/product_unavailable/);
    expect(await err(checkout("shop-a", [{ product_id: product.other, quantity: 1 }]))).toMatch(/product_not_found/);
    expect(await err(checkout("nope-nope", [{ product_id: product.bag, quantity: 1 }]))).toMatch(/store_not_found/);
    expect(await err(checkout("shop-a", [{ name: "Free stuff", quantity: 1, unit_price_kobo: 1 }]))).toMatch(/invalid_item/);
  });

  it("checks stock at checkout, but only reduces it when the vendor confirms", async () => {
    expect(await err(checkout("shop-a", [{ product_id: product.shoe, quantity: 2 }], "08077770001"))).toMatch(/insufficient_stock/);
    const r = (await checkout("shop-a", [{ product_id: product.shoe, quantity: 1 }], "08077770002")) as { order_id: string };
    expect(await stock(product.shoe)).toBe(1);
    await svc(`public.set_order_status($1,$2,'confirmed')`, [store.a, r.order_id]);
    expect(await stock(product.shoe)).toBe(0);
    await svc(`public.set_order_status($1,$2,'processing')`, [store.a, r.order_id]); // later statuses don't reduce it again
    await svc(`public.set_order_status($1,$2,'delivered')`, [store.a, r.order_id]);
    expect(await stock(product.shoe)).toBe(0);
    await svc(`public.set_order_status($1,$2,'cancelled')`, [store.a, r.order_id]); // cancelling a confirmed sale restores it
    expect(await stock(product.shoe)).toBe(1);
    expect(await err(svc(`public.set_order_status($1,$2,'confirmed')`, [store.a, r.order_id]))).toMatch(/order_cancelled/);
  });

  it("cancelling an order that was never confirmed leaves stock alone", async () => {
    const before = await stock(product.bag);
    const r = (await checkout("shop-a", [{ product_id: product.bag, quantity: 1 }], "08077770003")) as { order_id: string };
    await svc(`public.set_order_status($1,$2,'cancelled')`, [store.a, r.order_id]);
    expect(await stock(product.bag)).toBe(before);
  });

  it("matches a returning storefront customer by phone and limits repeated unconfirmed orders", async () => {
    const phone = "0803 999 0000";
    for (let i = 0; i < 5; i++) await checkout("shop-a", [{ product_id: product.untracked, quantity: 1 }], phone);
    expect(await err(checkout("shop-a", [{ product_id: product.untracked, quantity: 1 }], phone))).toMatch(/too_many_orders/);
    const n = await one<{ n: number }>(`select count(*)::int as n from public.customers where store_id=$1 and phone_key='08039990000'`, [store.a]);
    expect(n.n).toBe(1);
  });

  it("does not allow going back to pending, or an unknown status", async () => {
    const s = (await sale(store.a, { customer: { name: "Status Test", phone: "08055550001" }, items: [{ product_id: product.untracked, quantity: 1 }] })) as { order_id: string };
    expect(await err(svc(`public.set_order_status($1,$2,'pending')`, [store.a, s.order_id]))).toMatch(/invalid_transition/);
    expect(await err(svc(`public.set_order_status($1,$2,'teleported')`, [store.a, s.order_id]))).toMatch(/invalid_status/);
  });
});

describe("payments and debts", () => {
  let orderId = "";
  it("records partial and later payments, and blocks overpayment", async () => {
    const s = (await sale(store.a, { customer: { name: "Debtor Dan", phone: "08066660001" }, items: [{ product_id: product.untracked, quantity: 5 }], paid: 100_000, method: "cash" })) as { order_id: string };
    orderId = s.order_id; // total ₦5,000, paid ₦1,000
    const p = (await svc(`public.record_order_payment($1,$2,200000,'bank_transfer','second part')`, [store.a, orderId])) as { outstanding_kobo: number; payment_status: string };
    expect(p).toMatchObject({ outstanding_kobo: 200_000, payment_status: "partial" });
    expect(await err(svc(`public.record_order_payment($1,$2,200001,'cash',null)`, [store.a, orderId]))).toMatch(/overpayment/);
    const done = (await svc(`public.record_order_payment($1,$2,200000,'cash',null)`, [store.a, orderId])) as { payment_status: string };
    expect(done.payment_status).toBe("paid");
  });

  it("rejects non-positive amounts, unknown methods and cancelled orders", async () => {
    expect(await err(svc(`public.record_order_payment($1,$2,0,'cash',null)`, [store.a, orderId]))).toMatch(/invalid_payment/);
    expect(await err(svc(`public.record_order_payment($1,$2,100,'paystack',null)`, [store.a, orderId]))).toMatch(/invalid_payment/);
  });

  it("a manual payment can never be recorded as a Paystack payment", async () => {
    const msg = await err(db.query(`insert into public.order_payments (order_id, store_id, amount_kobo, method, source) values ($1,$2,100,'paystack','manual')`, [orderId, store.a]));
    expect(msg).toMatch(/order_payments_source_method/);
    const msg2 = await err(db.query(`insert into public.order_payments (order_id, store_id, amount_kobo, method, source) values ($1,$2,100,'cash','paystack')`, [orderId, store.a]));
    expect(msg2).toMatch(/order_payments_/);
  });

  it("one vendor cannot pay, update or receipt another vendor's order by guessing its id", async () => {
    expect(await err(svc(`public.record_order_payment($1,$2,100,'cash',null)`, [store.b, orderId]))).toMatch(/order_not_found/);
    expect(await err(svc(`public.set_order_status($1,$2,'cancelled')`, [store.b, orderId]))).toMatch(/order_not_found/);
    expect(await err(svc(`public.generate_receipt($1,$2)`, [store.b, orderId]))).toMatch(/order_not_found/);
  });
});

describe("receipts", () => {
  it("creates revision 1 once, re-issues a new revision when payments change, and keeps the original", async () => {
    const s = (await sale(store.a, { customer: { name: "Receipt Rita", phone: "08077771111" }, items: [{ product_id: product.untracked, quantity: 10 }], paid: 400_000, method: "cash" })) as { order_id: string };
    const r1 = (await svc(`public.generate_receipt($1,$2)`, [store.a, s.order_id])) as { receipt_no: string; revision: number; created: boolean; snapshot: { totals: { outstanding_kobo: number }; business: { name: string } } };
    expect(r1.revision).toBe(1);
    expect(r1.receipt_no).toMatch(/^RC-\d{6}$/);
    expect(r1.snapshot.totals.outstanding_kobo).toBe(600_000);
    expect(r1.snapshot.business.name).toBe("Shop A");

    const again = (await svc(`public.generate_receipt($1,$2)`, [store.a, s.order_id])) as { revision: number; created: boolean };
    expect(again).toMatchObject({ revision: 1, created: false });

    await svc(`public.record_order_payment($1,$2,600000,'pos',null)`, [store.a, s.order_id]);
    const r2 = (await svc(`public.generate_receipt($1,$2)`, [store.a, s.order_id])) as { receipt_no: string; revision: number; snapshot: { totals: { outstanding_kobo: number; payment_status: string }; payments: unknown[] } };
    expect(r2.revision).toBe(2);
    expect(r2.receipt_no).toBe(r1.receipt_no);
    expect(r2.snapshot.totals).toMatchObject({ outstanding_kobo: 0, payment_status: "paid" });
    expect(r2.snapshot.payments).toHaveLength(2);

    const old = await one<{ snapshot: { totals: { paid_kobo: number } } }>(`select snapshot from public.receipts where order_id=$1 and revision=1`, [s.order_id]);
    expect(old.snapshot.totals.paid_kobo).toBe(400_000);
  });

  it("numbers receipts per store, never repeating", async () => {
    const { rows } = await db.query<{ receipt_no: string }>(`select distinct receipt_no from public.receipts where store_id=$1`, [store.a]);
    expect(new Set(rows.map((r) => r.receipt_no)).size).toBe(rows.length);
  });
});

describe("dashboard and customer figures", () => {
  it("counts only sales as sales, and only this vendor's rows", async () => {
    const a = (await svc(`public.dashboard_summary($1)`, [store.a])) as Record<string, number | unknown[]>;
    const b = (await svc(`public.dashboard_summary($1)`, [store.b])) as Record<string, number | unknown[]>;
    const salesA = await one<{ t: string; o: string }>(
      `select coalesce(sum(total_kobo),0)::text as t, coalesce(sum(total_kobo-paid_kobo),0)::text as o from public.orders where store_id=$1 and status not in ('pending','cancelled')`,
      [store.a],
    );
    expect(String(a.total_sales_kobo)).toBe(salesA.t);
    expect(String(a.outstanding_kobo)).toBe(salesA.o);
    expect(a.sales_today_kobo).toBe(a.total_sales_kobo); // everything in this test happened today
    expect(Number(a.pending_orders)).toBeGreaterThan(0);
    expect(b.total_sales_kobo).toBe(100_000); // vendor B's single sale only
    expect((b.recent_orders as unknown[]).length).toBe(1);
    expect((a.low_stock as { name: string }[]).map((p) => p.name)).toContain("Sneakers");
    expect((a.low_stock as { name: string }[]).map((p) => p.name)).not.toContain("Gift wrap"); // untracked
  });
});

describe("privacy and permissions", () => {
  it("vendors read only their own orders, customers, payments, receipts and customer totals", async () => {
    await as("authenticated", owner.a);
    const orders = (await db.query<{ store_id: string }>(`select store_id from public.orders`)).rows;
    expect(orders.length).toBeGreaterThan(0);
    expect(orders.every((o) => o.store_id === store.a)).toBe(true);
    expect((await db.query<{ store_id: string }>(`select store_id from public.customers`)).rows.every((c) => c.store_id === store.a)).toBe(true);
    expect((await db.query<{ store_id: string }>(`select store_id from public.customer_overview`)).rows.every((c) => c.store_id === store.a)).toBe(true);
    expect((await db.query(`select 1 from public.order_items`)).rows.length).toBeGreaterThan(0);
    await reset();
    await as("authenticated", owner.b);
    expect((await db.query(`select 1 from public.orders where store_id = '${store.a}'`)).rows).toHaveLength(0);
    expect((await db.query(`select 1 from public.receipts where store_id = '${store.a}'`)).rows).toHaveLength(0);
    await reset();
  });

  it("customer totals add up: purchases, paid, outstanding and order count", async () => {
    await as("authenticated", owner.a);
    const c = (
      await db.query<{ order_count: number; total_purchases_kobo: string; total_paid_kobo: string; outstanding_kobo: string }>(
        `select order_count, total_purchases_kobo::text, total_paid_kobo::text, outstanding_kobo::text
           from public.customer_overview where name = 'Chidi Obi'`,
      )
    ).rows[0];
    await reset();
    expect(c.order_count).toBe(2); // the WhatsApp sale + the later one matched by phone
    expect(Number(c.total_purchases_kobo)).toBe(7_500_000 + 100_000);
    expect(Number(c.total_paid_kobo)).toBe(5_000_000);
    expect(Number(c.outstanding_kobo)).toBe(2_600_000);
  });

  it("browsers cannot write these tables or call the sales functions", async () => {
    await as("authenticated", owner.a);
    expect(await err(db.query(`update public.orders set paid_kobo = total_kobo`))).toMatch(/permission denied/);
    expect(await err(db.query(`insert into public.order_payments (order_id, store_id, amount_kobo, method) select id, store_id, 1, 'cash' from public.orders limit 1`))).toMatch(/permission denied/);
    expect(await err(db.query(`select public.record_sale('${store.a}', null, '{}'::jsonb, '[]'::jsonb, 'other', 0, null, null)`))).toMatch(/permission denied/);
    expect(await err(db.query(`select public.dashboard_summary('${store.a}')`))).toMatch(/permission denied/);
    await reset();
    await as("anon");
    expect(await err(db.query(`select 1 from public.orders`))).toMatch(/permission denied/);
    expect(await err(db.query(`select public.place_store_order('shop-a', '{}'::jsonb, '[]'::jsonb, null, null)`))).toMatch(/permission denied/);
    await reset();
  });

  it("the public store views still expose no order, customer or stock data", async () => {
    await as("anon");
    const cols = (await db.query<{ column_name: string }>(`select column_name from information_schema.columns where table_name = 'public_products'`)).rows.map((c) => c.column_name);
    await reset();
    expect(cols).not.toContain("stock_quantity");
    expect(cols).not.toContain("store_id");
  });
});
