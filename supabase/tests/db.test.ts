// @vitest-environment node
/**
 * Runs the real migration files against a real Postgres engine (PGlite, in-process WASM).
 * Supabase's own pieces (auth.users, auth.uid(), the anon/authenticated/service_role roles and their default
 * grants) are stubbed in BEFORE_MIGRATIONS so Row Level Security and privileges behave like they do on Supabase.
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RESERVED_SLUGS } from "../../src/lib/reservedSlugs";

const dir = path.resolve(__dirname, "../migrations");
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const migrations = files.map((f) => fs.readFileSync(path.join(dir, f), "utf8"));

const BEFORE_MIGRATIONS = `
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}');
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

let db: PGlite;
const ids = { a: "", b: "" };

const asUser = async (uid: string) =>
  db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`);
const asAnon = async () => db.exec(`set role anon; select set_config('request.jwt.claim.sub','',false);`);
const asService = async () => db.exec(`set role service_role;`);
const reset = async () => db.exec(`reset role;`);

const message = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  return null;
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(BEFORE_MIGRATIONS);
  for (const sql of migrations) await db.exec(sql);
  await db.exec(`insert into auth.users (email, raw_user_meta_data) values
    ('a@example.com', '{"full_name":"Ama Okafor"}'), ('b@example.com', '{}');`);
  const users = await db.query<{ id: string; email: string }>(`select id, email from auth.users order by email`);
  ids.a = users.rows[0].id;
  ids.b = users.rows[1].id;
});
afterAll(() => db.close());

describe("migrations", () => {
  it("can be run a second time without errors (safe to re-paste in the SQL Editor)", async () => {
    for (const sql of migrations) await db.exec(sql);
  });

  it("reserved_slugs matches src/lib/reservedSlugs.ts exactly", async () => {
    const { rows } = await db.query<{ slug: string }>(`select slug from public.reserved_slugs`);
    expect(new Set(rows.map((r) => r.slug))).toEqual(new Set(RESERVED_SLUGS));
  });
});

describe("profiles", () => {
  it("are created automatically on signup, with the name from user metadata", async () => {
    const { rows } = await db.query<{ full_name: string }>(`select full_name from public.profiles where id = $1`, [
      ids.a,
    ]);
    expect(rows[0].full_name).toBe("Ama Okafor");
    const b = await db.query<{ full_name: string }>(`select full_name from public.profiles where id = $1`, [ids.b]);
    expect(b.rows[0].full_name).toBe("");
  });

  it("can be read by their owner only, and never written from the browser", async () => {
    await asUser(ids.a);
    expect((await db.query(`select id from public.profiles`)).rows).toHaveLength(1);
    expect(await message(db.query(`update public.profiles set full_name = 'x'`))).toMatch(/permission denied/);
    await reset();
  });
});

describe("slug rules", () => {
  it.each([
    ["ab", "too_short"],
    ["a".repeat(31), "too_long"],
    ["Ama Hairs", "invalid_characters"],
    ["-ama", "invalid_characters"],
    ["ama--hairs", "invalid_characters"],
    ["admin", "reserved"],
    ["forgot-password", "reserved"],
    ["onboarding", "reserved"],
    ["ama-hairs", null],
  ])("slug_problem(%s) = %s", async (slug, expected) => {
    await asService();
    const { rows } = await db.query<{ p: string | null }>(`select public.slug_problem($1) as p`, [slug]);
    await reset();
    expect(rows[0].p).toBe(expected);
  });

  it("is callable by the service role only", async () => {
    await asUser(ids.a);
    expect(await message(db.query(`select public.slug_problem('x')`))).toMatch(/permission denied/);
    await reset();
  });
});

describe("stores", () => {
  const insert = (owner: string, slug: string, name = "Ama Hair Studio") =>
    db.query(`insert into public.stores (owner_id, name, slug, category) values ($1, $2, $3, 'Hair & wigs')`, [
      owner,
      name,
      slug,
    ]);

  it("only the service role can create stores (browsers cannot)", async () => {
    await asUser(ids.a);
    expect(await message(insert(ids.a, "sneaky"))).toMatch(/permission denied/);
    await reset();
    await asService();
    expect(await message(insert(ids.a, "ama-hairs"))).toBeNull();
    await reset();
  });

  it("rejects bad slugs at the database level, even from the service role", async () => {
    await asService();
    expect(await message(insert(ids.b, "Bad Slug"))).toMatch(/stores_slug_format/);
    expect(await message(insert(ids.b, "admin"))).toMatch(/slug_reserved/);
    expect(await message(insert(ids.b, "ama-hairs"))).toMatch(/stores_slug_key|duplicate/);
    await reset();
  });

  it("allows one store per vendor", async () => {
    await asService();
    expect(await message(insert(ids.a, "second-store"))).toMatch(/owner_id|duplicate/);
    await reset();
  });

  it("freezes the slug once created", async () => {
    await asService();
    expect(await message(db.query(`update public.stores set slug = 'renamed' where owner_id = $1`, [ids.a]))).toMatch(
      /slug_immutable/,
    );
    await reset();
  });

  it("owners see only their own store; other vendors see nothing", async () => {
    await asUser(ids.a);
    expect((await db.query(`select slug from public.stores`)).rows).toEqual([{ slug: "ama-hairs" }]);
    await asUser(ids.b);
    expect((await db.query(`select slug from public.stores`)).rows).toEqual([]);
    await reset();
  });

  it("anonymous visitors cannot read the table but can read published stores through public_stores", async () => {
    await asAnon();
    expect(await message(db.query(`select * from public.stores`))).toMatch(/permission denied/);
    expect((await db.query(`select slug from public.public_stores`)).rows).toEqual([]); // not published yet
    await reset();

    await db.exec(`update public.stores set is_published = true`);
    await asAnon();
    const { rows, fields } = await db.query(`select * from public.public_stores`);
    expect(rows).toHaveLength(1);
    expect(fields.map((f) => f.name)).not.toContain("owner_id");
    await reset();

    await db.exec(`update public.stores set status = 'suspended'`);
    await asAnon();
    expect((await db.query(`select slug from public.public_stores`)).rows).toEqual([]);
    await reset();
    await db.exec(`update public.stores set status = 'active', is_published = false`);
  });
});

describe("billing", () => {
  const plan = () =>
    db.query<{ price_kobo: number }>(`select price_kobo from public.subscription_plans where code = 'monthly'`);
  const newPayment = (ref: string, owner = ids.a, amount = 300000) =>
    db.query(
      `insert into public.payments (owner_id, plan_code, reference, amount_kobo) values ($1, 'monthly', $2, $3)`,
      [owner, ref, amount],
    );
  const apply = (ref: string, amount = 300000, currency = "NGN") =>
    db.query<{ r: { already_applied: boolean } }>(
      `select public.apply_successful_payment($1, $2, $3, 4242, 'card', now()) as r`,
      [ref, amount, currency],
    );

  it("seeds the ₦3,000 monthly plan", async () => {
    expect((await plan()).rows[0].price_kobo).toBe(300000);
  });

  it("activates the subscription and puts the store live on a verified payment", async () => {
    await asService();
    await newPayment("ref_1");
    expect((await apply("ref_1")).rows[0].r.already_applied).toBe(false);
    await reset();

    const sub = await db.query<{ status: string; days: number }>(
      `select status, round(extract(epoch from (current_period_end - now())) / 86400)::int as days from public.subscriptions where owner_id = $1`,
      [ids.a],
    );
    expect(sub.rows[0]).toEqual({ status: "active", days: 30 });
    expect(
      (await db.query<{ is_published: boolean }>(`select is_published from public.stores where owner_id = $1`, [ids.a]))
        .rows[0].is_published,
    ).toBe(true);
    expect(
      (await db.query<{ status: string }>(`select status from public.payments where reference = 'ref_1'`)).rows[0]
        .status,
    ).toBe("success");
  });

  it("is idempotent: the same reference never extends the subscription twice", async () => {
    await asService();
    expect((await apply("ref_1")).rows[0].r.already_applied).toBe(true);
    await reset();
    const { rows } = await db.query<{ days: number }>(
      `select round(extract(epoch from (current_period_end - now())) / 86400)::int as days from public.subscriptions where owner_id = $1`,
      [ids.a],
    );
    expect(rows[0].days).toBe(30);
  });

  it("extends from the end of the current period when renewing early", async () => {
    await asService();
    await newPayment("ref_2");
    await apply("ref_2");
    await reset();
    const { rows } = await db.query<{ days: number }>(
      `select round(extract(epoch from (current_period_end - now())) / 86400)::int as days from public.subscriptions where owner_id = $1`,
      [ids.a],
    );
    expect(rows[0].days).toBe(60);
  });

  it("refuses a payment whose amount, currency or reference does not match", async () => {
    await asService();
    await newPayment("ref_3", ids.b);
    expect(await message(apply("ref_3", 100))).toMatch(/payment_mismatch/);
    expect(await message(apply("ref_3", 300000, "USD"))).toMatch(/payment_mismatch/);
    expect(await message(apply("ref_unknown"))).toMatch(/payment_not_found/);
    await reset();
    expect((await db.query(`select 1 from public.subscriptions where owner_id = $1`, [ids.b])).rows).toHaveLength(0);
  });

  it("cannot be called from a browser session", async () => {
    await asUser(ids.a);
    expect(await message(apply("ref_1"))).toMatch(/permission denied/);
    await reset();
  });

  it("vendors read only their own subscription and payments, and cannot write them", async () => {
    await asUser(ids.a);
    expect((await db.query(`select 1 from public.subscriptions`)).rows).toHaveLength(1);
    expect((await db.query(`select 1 from public.payments`)).rows.length).toBe(2);
    expect(
      await message(db.query(`update public.subscriptions set current_period_end = now() + interval '5 years'`)),
    ).toMatch(/permission denied/);
    expect(
      await message(
        db.query(
          `insert into public.payments (owner_id, plan_code, reference, amount_kobo) values ('${ids.a}','monthly','x',1)`,
        ),
      ),
    ).toMatch(/permission denied/);
    await asUser(ids.b);
    expect((await db.query(`select 1 from public.subscriptions`)).rows).toHaveLength(0);
    expect((await db.query(`select 1 from public.payments`)).rows).toHaveLength(1); // only B's own pending payment
    await reset();
  });

  it("webhook_events is invisible to browsers", async () => {
    await asUser(ids.a);
    expect(await message(db.query(`select * from public.webhook_events`))).toMatch(/permission denied/);
    await reset();
  });

  it("expires lapsed subscriptions and takes their store offline", async () => {
    await db.exec(`update public.subscriptions set current_period_end = now() - interval '1 day'`);
    await asService();
    const { rows } = await db.query<{ n: number }>(`select public.expire_lapsed_subscriptions() as n`);
    await reset();
    expect(rows[0].n).toBe(1);
    expect(
      (await db.query<{ status: string }>(`select status from public.subscriptions where owner_id = $1`, [ids.a]))
        .rows[0].status,
    ).toBe("expired");
    expect(
      (await db.query<{ is_published: boolean }>(`select is_published from public.stores where owner_id = $1`, [ids.a]))
        .rows[0].is_published,
    ).toBe(false);
  });

  it("goes live again after renewing", async () => {
    await asService();
    await newPayment("ref_4");
    await apply("ref_4");
    await reset();
    const { rows } = await db.query<{ status: string; live: boolean; days: number }>(
      `select s.status, st.is_published as live, round(extract(epoch from (s.current_period_end - now())) / 86400)::int as days
         from public.subscriptions s join public.stores st on st.owner_id = s.owner_id where s.owner_id = $1`,
      [ids.a],
    );
    expect(rows[0]).toEqual({ status: "active", live: true, days: 30 });
  });
});

describe("setup.sql bundle", () => {
  it("is up to date with the migration files (run `npm run db:bundle`)", () => {
    const bundle = fs.readFileSync(path.resolve(__dirname, "../setup.sql"), "utf8");
    for (const sql of migrations) expect(bundle).toContain(sql.trimEnd());
    expect(files.every((f) => bundle.includes(`-- ${f}`))).toBe(true);
  });
});
