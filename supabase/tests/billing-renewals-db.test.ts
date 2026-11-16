// @vitest-environment node
/** Billing renewals, run on a real Postgres engine with ALL migrations applied on top of each other. */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = path.resolve(__dirname, "../migrations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const migrations = files.map((f) => fs.readFileSync(path.join(dir, f), "utf8"));
const MIGRATION = migrations[files.findIndex((f) => f.includes("billing_renewals"))];

const STUBS = `
  create schema auth;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

let db: PGlite;
const owner: Record<string, string> = {};
const as = (role: string, uid = "") => db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${uid}',false);`);
const reset = () => db.exec("reset role;");
const rows = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const fails = async (sql: string, params: unknown[] = []) => {
  try {
    await db.query(sql, params);
  } catch (e) {
    return (e as Error).message;
  }
  return null;
};

const PRICE = 300000;
const renew = (customer: string, ref: string, over: { email?: string | null; allowEmail?: boolean; amount?: number; currency?: string; paidAt?: string | null } = {}) =>
  rows<{ r: { already_applied: boolean; current_period_end?: string; owner_id: string } }>(
    `select public.apply_renewal_payment($1,$2,$3,$4,$5,$6,777,'card',$7) as r`,
    [customer, over.email ?? null, over.allowEmail ?? false, ref, over.amount ?? PRICE, over.currency ?? "NGN", over.paidAt ?? null],
  );
const fail = (customer: string, ref: string | null, reason = "Insufficient funds", email: string | null = null, allowEmail = false) =>
  rows<{ r: { flagged: boolean } }>(`select public.record_renewal_failure($1,$2,$3,$4,$5) as r`, [customer, email, allowEmail, ref, reason]);
const sub = async (key: string) =>
  (await rows<{ status: string; auto_renew: boolean; renewal_failed_at: Date | null; renewal_failure_reason: string | null; period_end: Date }>(
    `select status, auto_renew, renewal_failed_at, renewal_failure_reason, current_period_end as period_end from public.subscriptions where owner_id = $1`, [owner[key]]))[0];
const live = async (key: string) => (await rows<{ is_published: boolean }>(`select is_published from public.stores where owner_id = $1`, [owner[key]]))[0].is_published;
const monthsAfter = async (a: Date, b: Date) => (await rows<{ ok: boolean }>(`select $1::timestamptz + interval '1 month' = $2::timestamptz as ok`, [a.toISOString(), b.toISOString()]))[0].ok;

async function addVendor(key: string, slug: string, email: string) {
  const u = await rows<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email]);
  owner[key] = u[0].id;
  await db.query(
    `insert into public.stores (owner_id, name, slug, category, state, description) values ($1,$2,$3,'Hair & wigs','Lagos','Quality human hair, wigs and extensions shipped across Nigeria.')`,
    [owner[key], slug, slug],
  );
}
/** The vendor's first, checkout payment (our own reference), exactly as the existing flow records it. */
async function firstPayment(key: string, ref: string) {
  await db.query(`insert into public.payments (owner_id, plan_code, reference, amount_kobo) values ($1,'monthly',$2,$3)`, [owner[key], ref, PRICE]);
  await db.query(`select public.apply_successful_payment($1,$2,'NGN',123,'card',now())`, [ref, PRICE]);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  for (const sql of migrations) await db.exec(sql);
  await addVendor("a", "ama-hairs", "ama@example.com");
  await addVendor("b", "glow-by-ife", "ife@example.com");
  await addVendor("never", "never-paid", "new@example.com");
  await firstPayment("a", "ss_sub_a1");
  await firstPayment("b", "ss_sub_b1");
  await db.query(`select public.link_billing_account($1,'CUS_ama','SUB_ama')`, [owner.a]);
  await db.query(`select public.link_billing_account($1,'CUS_ife','SUB_ife')`, [owner.b]);
});
afterAll(() => db.close());

describe("the migration", () => {
  it("can be pasted again and again on a database that already has it", async () => {
    await db.exec(MIGRATION);
    await db.exec(MIGRATION);
  });
  it("the first payment extends by exactly one calendar month", async () => {
    const s = await sub("b");
    const [{ start }] = await rows<{ start: Date }>(`select current_period_start as start from public.subscriptions where owner_id = $1`, [owner.b]);
    expect(await monthsAfter(start, s.period_end)).toBe(true);
    expect(s.renewal_failed_at).toBeNull();
  });
});

describe("a successful automatic renewal (Paystack's own reference)", () => {
  it("extends the subscription by another month from the end of the current period", async () => {
    const before = await sub("a");
    const res = await renew("CUS_ama", "T_renewal_1", { paidAt: new Date(before.period_end.getTime() - 60_000).toISOString() });
    expect(res[0].r.already_applied).toBe(false);
    const after = await sub("a");
    expect(await monthsAfter(before.period_end, after.period_end)).toBe(true);
    expect(after).toMatchObject({ status: "active", auto_renew: true });
  });

  it("records the renewal as a payment of its own", async () => {
    expect(await rows(`select kind, status, amount_kobo from public.payments where reference = 'T_renewal_1'`)).toEqual([{ kind: "renewal", status: "success", amount_kobo: PRICE }]);
  });

  it("is idempotent: Paystack sending the same event twice does not extend twice", async () => {
    const before = await sub("a");
    expect((await renew("CUS_ama", "T_renewal_1"))[0].r.already_applied).toBe(true);
    expect((await sub("a")).period_end).toEqual(before.period_end);
  });

  it("does not touch any other vendor", async () => {
    const [{ n }] = await rows<{ n: number }>(`select count(*)::int n from public.payments where owner_id = $1 and kind = 'renewal'`, [owner.b]);
    expect(n).toBe(0);
  });

  it("clamps month-ends sensibly (31 January → 28 February)", async () => {
    await db.exec(`update public.subscriptions set current_period_end = '2027-01-31T10:00:00Z', current_period_start = '2026-12-31T10:00:00Z' where owner_id = '${owner.b}'`);
    const res = await renew("CUS_ife", "T_renewal_feb", { paidAt: "2027-01-31T09:59:00Z" });
    expect(new Date(res[0].r.current_period_end!).toISOString()).toBe("2027-02-28T10:00:00.000Z");
  });

  it("an expired vendor whose card is finally charged goes live again, counted from the payment", async () => {
    await db.exec(`update public.subscriptions set current_period_end = now() - interval '2 days', status = 'active' where owner_id = '${owner.a}'`);
    await as("service_role");
    await rows(`select public.expire_lapsed_subscriptions()`);
    await reset();
    expect((await sub("a")).status).toBe("expired");
    expect(await live("a")).toBe(false);

    const paid = new Date(Date.now() - 3600_000);
    await renew("CUS_ama", "T_renewal_late", { paidAt: paid.toISOString() });
    const s = await sub("a");
    expect(s.status).toBe("active");
    expect(await monthsAfter(paid, s.period_end)).toBe(true);
    expect(await live("a")).toBe(true);
  });
});

describe("renewals that must NOT be applied", () => {
  it.each([
    ["a wrong amount", { amount: 100 }],
    ["another currency", { currency: "USD" }],
  ])("refuses %s", async (_label, over) => {
    const before = await sub("a");
    expect(await fails(`select public.apply_renewal_payment('CUS_ama',null,false,'T_bad',$1,$2,1,'card',null)`, [over.amount ?? PRICE, over.currency ?? "NGN"])).toMatch(/payment_mismatch/);
    expect((await sub("a")).period_end).toEqual(before.period_end);
    expect(await rows(`select 1 from public.payments where reference = 'T_bad'`)).toHaveLength(0);
  });

  it("refuses a customer we have never seen", async () => {
    expect(await fails(`select public.apply_renewal_payment('CUS_stranger',null,false,'T_x',${PRICE},'NGN',1,'card',null)`)).toMatch(/billing_account_not_found/);
  });

  it("only falls back to the login email when the plan was confirmed as ours", async () => {
    expect(await fails(`select public.apply_renewal_payment('CUS_new','new@example.com',false,'T_e1',${PRICE},'NGN',1,'card',null)`)).toMatch(/billing_account_not_found/);
    expect(await rows(`select 1 from public.billing_accounts where owner_id = $1`, [owner.never])).toHaveLength(0);

    const res = await renew("CUS_new", "T_e2", { email: "NEW@example.com", allowEmail: true });
    expect(res[0].r.owner_id).toBe(owner.never);
    expect(await rows(`select paystack_customer_code from public.billing_accounts where owner_id = $1`, [owner.never])).toEqual([{ paystack_customer_code: "CUS_new" }]);
    expect(await sub("never")).toMatchObject({ status: "active", auto_renew: true });
    // and from now on the customer code alone is enough
    expect((await renew("CUS_new", "T_e3"))[0].r.owner_id).toBe(owner.never);
  });

  it("does not apply a reference that already belongs to a different vendor", async () => {
    expect(await fails(`select public.apply_renewal_payment('CUS_ife',null,false,'ss_sub_a1',${PRICE},'NGN',1,'card',null)`)).toMatch(/payment_mismatch/);
  });
});

describe("a failed automatic renewal", () => {
  it("is flagged for the vendor, with a reason, and recorded as a failed payment", async () => {
    expect((await fail("CUS_ife", "T_failed_1", "Insufficient funds"))[0].r.flagged).toBe(true);
    const s = await sub("b");
    expect(s.renewal_failed_at).toBeInstanceOf(Date);
    expect(s.renewal_failure_reason).toBe("Insufficient funds");
    expect(await rows(`select kind, status from public.payments where reference = 'T_failed_1'`)).toEqual([{ kind: "renewal", status: "failed" }]);
  });

  it("does not remove access by itself (no early lock-out)", async () => {
    expect((await sub("b")).status).toBe("active");
  });

  it("uses a sensible message when Paystack gives none, and keeps it short", async () => {
    await fail("CUS_ife", null, "   ");
    expect((await sub("b")).renewal_failure_reason).toBe("The payment was declined.");
    await fail("CUS_ife", null, "x".repeat(500));
    expect((await sub("b")).renewal_failure_reason).toHaveLength(200);
  });

  it("is repeated safely when Paystack retries the same event", async () => {
    await fail("CUS_ife", "T_failed_1");
    expect(await rows(`select 1 from public.payments where reference = 'T_failed_1'`)).toHaveLength(1);
  });

  it("is cleared by the next successful automatic renewal", async () => {
    await renew("CUS_ife", "T_ok_after_fail");
    expect(await sub("b")).toMatchObject({ renewal_failed_at: null, renewal_failure_reason: null });
  });

  it("is also cleared when the vendor pays again through checkout", async () => {
    await fail("CUS_ife", "T_failed_2");
    expect((await sub("b")).renewal_failed_at).not.toBeNull();
    await firstPayment("b", "ss_sub_b2");
    expect((await sub("b")).renewal_failed_at).toBeNull();
  });

  it("ignores a failure for someone who never completed a payment, and for unknown customers", async () => {
    await db.query(`select public.link_billing_account($1,'CUS_ghost')`, [owner.never]);
    await db.exec(`delete from public.subscriptions where owner_id = '${owner.never}'`);
    expect((await fail("CUS_ghost", null))[0].r.flagged).toBe(false);
    expect(await fails(`select public.record_renewal_failure('CUS_nobody',null,false,null,'x')`)).toMatch(/billing_account_not_found/);
  });
});

describe("auto-renew switched on or cancelled", () => {
  it("'created' links the subscription and turns auto-renew on; cancelling turns it off", async () => {
    await db.query(`select public.record_subscription_state('CUS_ama',null,false,'not_renew',null)`);
    expect((await sub("a")).auto_renew).toBe(false);
    await db.query(`select public.record_subscription_state('CUS_ama',null,false,'created','SUB_ama_2')`);
    expect((await sub("a")).auto_renew).toBe(true);
    expect(await rows(`select paystack_subscription_code from public.billing_accounts where owner_id = $1`, [owner.a])).toEqual([{ paystack_subscription_code: "SUB_ama_2" }]);
    await db.query(`select public.record_subscription_state('CUS_ama',null,false,'disabled',null)`);
    expect((await sub("a")).auto_renew).toBe(false);
  });
  it("rejects an unknown state", async () => {
    expect(await fails(`select public.record_subscription_state('CUS_ama',null,false,'explode',null)`)).toMatch(/invalid_state/);
  });
});

describe("who may call this", () => {
  it.each([
    [`select public.apply_renewal_payment('CUS_ama',null,false,'T_hack',${PRICE},'NGN',1,'card',null)`],
    [`select public.record_renewal_failure('CUS_ama',null,false,null,'x')`],
    [`select public.record_subscription_state('CUS_ama',null,false,'disabled',null)`],
    [`select public.link_billing_account(gen_random_uuid(),'CUS_x',null)`],
    [`select public.billing_resolve_owner('CUS_ama',null,false)`],
  ])("a vendor's browser session cannot run %s", async (sql) => {
    for (const role of ["authenticated", "anon"]) {
      await as(role, owner.a);
      expect(await fails(sql), role).toMatch(/permission denied/);
      await reset();
    }
  });
  it("billing_accounts is invisible to browsers", async () => {
    await as("authenticated", owner.a);
    expect(await fails(`select * from public.billing_accounts`)).toMatch(/permission denied/);
    await reset();
  });
  it("vendors can read their own subscription row (incl. the renewal notice fields) but not change it", async () => {
    await as("authenticated", owner.b);
    expect((await rows(`select renewal_failed_at, auto_renew from public.subscriptions`)).length).toBe(1);
    expect(await fails(`update public.subscriptions set renewal_failed_at = null`)).toMatch(/permission denied/);
    await reset();
  });
});

describe("backfill of renewals the old webhook ignored", () => {
  const SQL = fs.readFileSync(path.resolve(__dirname, "../backfill-missed-renewals.sql"), "utf8");
  const event = (ref: string, customer: string, email: string, over: Record<string, unknown> = {}) =>
    db.query(`insert into public.webhook_events (provider, event, reference, payload) values ('paystack','charge.success',$1,$2)`, [
      ref,
      JSON.stringify({ event: "charge.success", data: { reference: ref, id: 9001, amount: PRICE, currency: "NGN", channel: "card", paid_at: new Date().toISOString(), customer: { customer_code: customer, email }, plan: { plan_code: "PLN_ours" }, ...over } }),
    ]);

  it("applies ignored renewals once, marks them processed, and leaves unmatched or wrong-amount ones alone", async () => {
    await addVendor("late", "late-payer", "late@example.com");
    await firstPayment("late", "ss_sub_late1");
    const before = await sub("late");
    await event("T_old_1", "CUS_late", "late@example.com"); // unknown customer: matched through the email + plan
    await event("T_old_2", "CUS_stranger", "nobody@example.com"); // nobody has this email
    await event("T_old_3", "CUS_late", "late@example.com", { amount: 123 }); // not the plan price
    await db.exec(SQL);

    const after = await sub("late");
    expect(await monthsAfter(before.period_end, after.period_end)).toBe(true);
    const processed = await rows<{ reference: string; done: boolean }>(`select reference, processed_at is not null as done from public.webhook_events where reference like 'T\\_old\\_%' order by reference`);
    expect(processed).toEqual([{ reference: "T_old_1", done: true }, { reference: "T_old_2", done: false }, { reference: "T_old_3", done: false }]);

    await db.exec(SQL); // again: nothing is applied twice
    expect((await sub("late")).period_end).toEqual(after.period_end);
  });
});
