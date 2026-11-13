// @vitest-environment node
/** SEO database rules, run on a real Postgres engine: eligibility, public views, sitemaps, redirects, privacy. */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { slugify } from "../../src/lib/reservedSlugs";

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

const as = async (role: "anon" | "authenticated" | "service_role", uid = "") =>
  db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${uid}',false);`);
const reset = () => db.exec("reset role;");
const rows = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows;
const fails = async (sql: string) => {
  try {
    await db.exec(sql);
  } catch (e) {
    return (e as Error).message;
  }
  return null;
};

const LONG = "Quality human hair, wigs and extensions for every look, shipped across Nigeria.";

async function addStore(
  key: string,
  slug: string,
  opts: {
    name?: string;
    category?: string;
    city?: string;
    state?: string;
    description?: string;
    published?: boolean;
    status?: string;
    indexable?: boolean;
  } = {},
) {
  const u = await rows<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [
    `${key}@example.com`,
  ]);
  owner[key] = u[0].id;
  const s = await rows<{ id: string }>(
    `insert into public.stores (owner_id, name, slug, category, city, state, description, is_published, status, indexable)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
    [
      owner[key],
      opts.name ?? slug,
      slug,
      opts.category ?? "Hair & wigs",
      opts.city ?? "Abuja",
      opts.state ?? "FCT (Abuja)",
      opts.description ?? LONG,
      opts.published ?? true,
      opts.status ?? "active",
      opts.indexable ?? true,
    ],
  );
  store[key] = s[0].id;
}

async function addProduct(
  key: string,
  slug: string,
  opts: {
    name?: string;
    description?: string;
    status?: string;
    image?: boolean;
    stock?: number | null;
    price?: number;
  } = {},
) {
  const p = await rows<{ id: string }>(
    `insert into public.products (store_id, slug, name, description, price_kobo, status, stock_quantity)
     values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [
      store[key],
      slug,
      opts.name ?? slug,
      opts.description ?? "A genuinely useful description of this product.",
      opts.price ?? 4500000,
      opts.status ?? "published",
      opts.stock ?? null,
    ],
  );
  if (opts.image !== false) {
    await db.query(
      `insert into public.product_images (product_id, url, alt_text, position, width, height) values ($1,$2,$3,0,1200,800)`,
      [p[0].id, `https://img.example.com/${key}/${slug}.jpg`, `${slug} photo`],
    );
  }
  return p[0].id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  for (const sql of migrations) await db.exec(sql);

  await addStore("a", "ama-hairs", { name: "Ama Hair Studio" }); // complete + eligible products
  await addStore("b", "glow-by-ife", {
    name: "Glow by Ife",
    category: "Skincare & beauty",
    city: "Ikeja",
    state: "Lagos",
  });
  await addStore("empty", "empty-shop"); // published, no products
  await addStore("noimg", "no-images"); // product without image
  await addStore("susp", "suspended-shop", { status: "suspended" });
  await addStore("draft", "unpublished-shop", { published: false });
  await addStore("optout", "no-index-shop", { indexable: false });
  await addStore("short", "short-desc", { description: "Too short." });

  await addProduct("a", "body-wave-wig", { name: "Body Wave Wig", stock: 5 });
  await addProduct("a", "straight-bundle", { name: "Straight Bundle", stock: 0 }); // out of stock but still eligible
  await addProduct("a", "secret-draft", { status: "draft" });
  await addProduct("a", "old-product", { status: "archived" });
  await addProduct("a", "no-photo", { image: false });
  await addProduct("b", "body-wave-wig", { name: "Glow Serum" }); // same slug, different vendor
  await addProduct("noimg", "only-product", { image: false });
  await addProduct("susp", "hidden", {});
  await addProduct("draft", "hidden-too", {});
  await addProduct("optout", "opt-out-item", {});
  await addProduct("short", "p1", {});
});
afterAll(() => db.close());

describe("slugify parity with the website", () => {
  it.each([
    "Hair & wigs",
    "FCT (Abuja)",
    "Ama's  Shop!",
    "Benin City",
    "  Skincare & beauty ",
    "Thrift & fashion",
    "Lagos",
  ])("%s", async (input) => {
    expect((await rows<{ s: string }>(`select public.slugify($1) as s`, [input]))[0].s).toBe(slugify(input));
  });
});

describe("store indexing eligibility", () => {
  const get = (slug: string) =>
    rows<{ is_indexable: boolean }>(`select is_indexable from public.public_stores where slug = $1`, [slug]);

  it("a complete store with an eligible product is indexable", async () => {
    expect((await get("ama-hairs"))[0].is_indexable).toBe(true);
    expect((await get("glow-by-ife"))[0].is_indexable).toBe(true);
  });

  it.each(["empty-shop", "no-images", "no-index-shop", "short-desc"])(
    "%s is public but NOT indexable",
    async (slug) => {
      const r = await get(slug);
      expect(r).toHaveLength(1);
      expect(r[0].is_indexable).toBe(false);
    },
  );

  it.each(["suspended-shop", "unpublished-shop"])("%s is not public at all", async (slug) => {
    expect(await get(slug)).toHaveLength(0);
  });

  it("the vendor-facing status explains why a store is not eligible", async () => {
    await as("service_role");
    const empty = await rows<{ s: { eligible: boolean; problems: string[]; published_products: number } }>(
      `select public.store_seo_status($1) as s`,
      [owner.empty],
    );
    const noimg = await rows<{ s: { problems: string[]; published_products: number; eligible_products: number } }>(
      `select public.store_seo_status($1) as s`,
      [owner.noimg],
    );
    const ok = await rows<{ s: { eligible: boolean; eligible_products: number; published_products: number } }>(
      `select public.store_seo_status($1) as s`,
      [owner.a],
    );
    const none = await rows<{ s: unknown }>(`select public.store_seo_status(gen_random_uuid()) as s`);
    await reset();
    expect(empty[0].s.eligible).toBe(false);
    expect(empty[0].s.problems).toContain("no_eligible_products");
    expect(noimg[0].s.published_products).toBe(1);
    expect(noimg[0].s.eligible_products).toBe(0);
    expect(ok[0].s).toMatchObject({ eligible: true, eligible_products: 2, published_products: 3 });
    expect(none[0].s).toBeNull();
  });

  it("is callable by the service role only", async () => {
    await as("authenticated", owner.a);
    expect(await fails(`select public.store_seo_status('${owner.a}')`)).toMatch(/permission denied/);
    await reset();
  });
});

describe("product eligibility and public pages", () => {
  const pub = (storeSlug: string) =>
    rows<{ slug: string; is_indexable: boolean; is_available: boolean }>(
      `select slug, is_indexable, is_available from public.public_products where store_slug = $1 order by slug`,
      [storeSlug],
    );

  it("only published products are public; drafts and archived never appear", async () => {
    const slugs = (await pub("ama-hairs")).map((p) => p.slug);
    expect(slugs).toEqual(["body-wave-wig", "no-photo", "straight-bundle"]);
  });

  it("a product with no image is public but not indexable", async () => {
    expect((await pub("ama-hairs")).find((p) => p.slug === "no-photo")?.is_indexable).toBe(false);
  });

  it("out-of-stock products stay indexable, with accurate availability", async () => {
    const p = (await pub("ama-hairs")).find((x) => x.slug === "straight-bundle")!;
    expect(p).toMatchObject({ is_indexable: true, is_available: false });
    expect((await pub("ama-hairs")).find((x) => x.slug === "body-wave-wig")).toMatchObject({
      is_indexable: true,
      is_available: true,
    });
  });

  it("products of suspended, unpublished and opted-out stores are never indexable (or even public when hidden)", async () => {
    expect(await pub("suspended-shop")).toHaveLength(0);
    expect(await pub("unpublished-shop")).toHaveLength(0);
    expect((await pub("no-index-shop"))[0].is_indexable).toBe(false);
  });

  it("two vendors can use the same product slug without any cross-over", async () => {
    const a = await rows<{ name: string }>(
      `select name from public.public_products where store_slug = 'ama-hairs' and slug = 'body-wave-wig'`,
    );
    const b = await rows<{ name: string }>(
      `select name from public.public_products where store_slug = 'glow-by-ife' and slug = 'body-wave-wig'`,
    );
    expect(a.map((r) => r.name)).toEqual(["Body Wave Wig"]);
    expect(b.map((r) => r.name)).toEqual(["Glow Serum"]);
  });

  it("a product cannot be reached through another vendor's store path", async () => {
    expect(
      await rows(`select 1 from public.public_products where store_slug = 'glow-by-ife' and slug = 'straight-bundle'`),
    ).toHaveLength(0);
    expect(
      await rows(`select 1 from public.public_products where store_slug = 'empty-shop' and slug = 'body-wave-wig'`),
    ).toHaveLength(0);
  });

  it("one vendor cannot reuse a product slug within the same store", async () => {
    expect(
      await fails(
        `insert into public.products (store_id, slug, name, price_kobo) values ('${store.a}', 'body-wave-wig', 'Dupe', 100)`,
      ),
    ).toMatch(/products_slug_unique_per_store|duplicate/);
  });

  it("returns ordered images with alt text and dimensions", async () => {
    const r = await rows<{ images: { url: string; alt: string; width: number; height: number }[] }>(
      `select images from public.public_products where store_slug = 'ama-hairs' and slug = 'body-wave-wig'`,
    );
    expect(r[0].images).toEqual([
      { url: "https://img.example.com/a/body-wave-wig.jpg", alt: "body-wave-wig photo", width: 1200, height: 800 },
    ]);
  });
});

describe("renamed products redirect to their new URL", () => {
  it("records the old slug, follows chains of renames, and drops it when renamed back", async () => {
    await db.exec(
      `update public.products set slug = 'body-wave-wig-24in' where store_id = '${store.a}' and slug = 'body-wave-wig'`,
    );
    expect(
      await rows(`select old_slug, new_slug from public.public_product_redirects where store_slug = 'ama-hairs'`),
    ).toEqual([{ old_slug: "body-wave-wig", new_slug: "body-wave-wig-24in" }]);

    await db.exec(
      `update public.products set slug = 'body-wave-wig-final' where store_id = '${store.a}' and slug = 'body-wave-wig-24in'`,
    );
    expect(
      (
        await rows(
          `select old_slug, new_slug from public.public_product_redirects where store_slug = 'ama-hairs' order by old_slug`,
        )
      ).map((r) => r),
    ).toEqual([
      { old_slug: "body-wave-wig", new_slug: "body-wave-wig-final" },
      { old_slug: "body-wave-wig-24in", new_slug: "body-wave-wig-final" },
    ]);

    await db.exec(
      `update public.products set slug = 'body-wave-wig' where store_id = '${store.a}' and slug = 'body-wave-wig-final'`,
    );
    const left = await rows<{ old_slug: string }>(
      `select old_slug from public.public_product_redirects where store_slug = 'ama-hairs'`,
    );
    expect(left.map((r) => r.old_slug)).not.toContain("body-wave-wig");
  });

  it("stops redirecting once the product is no longer published", async () => {
    await db.exec(
      `update public.products set status = 'draft' where store_id = '${store.a}' and slug = 'body-wave-wig'`,
    );
    expect(await rows(`select 1 from public.public_product_redirects where store_slug = 'ama-hairs'`)).toHaveLength(0);
    await db.exec(
      `update public.products set status = 'published' where store_id = '${store.a}' and slug = 'body-wave-wig'`,
    );
  });
});

describe("sitemap views", () => {
  it("list only indexable stores", async () => {
    const slugs = (await rows<{ slug: string }>(`select slug from public.sitemap_stores order by slug`)).map(
      (r) => r.slug,
    );
    expect(slugs).toEqual(["ama-hairs", "glow-by-ife"]);
  });

  it("list only indexable products: no drafts, archived, image-less, suspended or opted-out", async () => {
    const urls = (
      await rows<{ store_slug: string; slug: string }>(
        `select store_slug, slug from public.sitemap_products order by 1, 2`,
      )
    ).map((r) => `${r.store_slug}/${r.slug}`);
    // short-desc/p1 is listed on purpose: a product only needs a valid, published vendor; an incomplete STORE profile
    // keeps the store page out of the sitemap but does not hide its genuinely complete products.
    expect(urls).toEqual([
      "ama-hairs/body-wave-wig",
      "ama-hairs/straight-bundle",
      "glow-by-ife/body-wave-wig",
      "short-desc/p1",
    ]);
  });

  it("last-modified follows product edits, so crawlers see accurate dates", async () => {
    await db.exec(`update public.products set updated_at = now() + interval '2 days' where store_id = '${store.b}'`);
    const [s] = await rows<{ last_modified: Date; updated_at: Date }>(
      `select s.last_modified, p.updated_at from public.public_stores s, public.public_stores p where s.slug = 'glow-by-ife' and p.slug = 'glow-by-ife'`,
    );
    const [prod] = await rows<{ last_modified: Date }>(
      `select last_modified from public.sitemap_products where store_slug = 'glow-by-ife'`,
    );
    expect(new Date(s.last_modified).getTime()).toBeGreaterThan(new Date(s.updated_at).getTime());
    expect(prod.last_modified).toBeInstanceOf(Date);
  });
});

describe("directory views", () => {
  it("count only indexable stores, by category and by location", async () => {
    expect(await rows(`select slug, name, store_count from public.public_directory_categories order by slug`)).toEqual([
      { slug: "hair-wigs", name: "Hair & wigs", store_count: 1 },
      { slug: "skincare-beauty", name: "Skincare & beauty", store_count: 1 },
    ]);
    const loc = await rows<{ kind: string; slug: string }>(
      `select kind, slug from public.public_directory_locations order by kind, slug`,
    );
    expect(loc).toEqual([
      { kind: "city", slug: "abuja" },
      { kind: "city", slug: "ikeja" },
      { kind: "state", slug: "fct-abuja" },
      { kind: "state", slug: "lagos" },
    ]);
  });
});

describe("privacy: what the public views reveal", () => {
  it.each([
    "public_stores",
    "public_products",
    "public_product_redirects",
    "sitemap_stores",
    "sitemap_products",
    "public_directory_categories",
    "public_directory_locations",
  ])("%s exposes no private columns", async (view) => {
    const cols = (
      await rows<{ column_name: string }>(
        `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`,
        [view],
      )
    ).map((c) => c.column_name);
    for (const secret of [
      "owner_id",
      "contact_phone",
      "contact_email",
      "store_id",
      "status",
      "is_published",
      "stock_quantity",
      "indexable",
    ]) {
      expect(cols, `${view} must not expose ${secret}`).not.toContain(secret);
    }
  });

  it("anonymous visitors read the views but never the tables", async () => {
    await as("anon");
    expect((await rows(`select slug from public.public_stores`)).length).toBeGreaterThan(0);
    for (const table of ["stores", "products", "product_images", "product_slug_redirects"]) {
      expect(await fails(`select * from public.${table}`), table).toMatch(/permission denied/);
    }
    await reset();
  });

  it("vendors see only their own products and cannot write any", async () => {
    await as("authenticated", owner.a);
    const mine = await rows<{ slug: string }>(`select slug from public.products`);
    expect(mine.length).toBe(5);
    expect(await fails(`update public.products set name = 'x'`)).toMatch(/permission denied/);
    expect(
      await fails(
        `insert into public.products (store_id, slug, name, price_kobo) values ('${store.a}','hack','Hack',1)`,
      ),
    ).toMatch(/permission denied/);
    await as("authenticated", owner.b);
    expect((await rows(`select slug from public.products`)).length).toBe(1);
    expect((await rows(`select 1 from public.product_images`)).length).toBe(1);
    await reset();
  });
});

describe("sanitisation at the database level", () => {
  const cases: [string, (a: string) => string, string][] = [
    [
      "script tag in a store SEO title",
      (a) => `update public.stores set seo_title = '<script>alert(1)</script>' where id = '${a}'`,
      "stores_text_no_markup",
    ],
    [
      "HTML in a store SEO description",
      (a) => `update public.stores set seo_description = 'Great <b>store</b>' where id = '${a}'`,
      "stores_text_no_markup",
    ],
    [
      "a non-https social image",
      (a) => `update public.stores set og_image_url = 'http://insecure.example.com/a.jpg' where id = '${a}'`,
      "stores_og_image_https",
    ],
    [
      "a junk phone number",
      (a) => `update public.stores set contact_phone = 'call me maybe' where id = '${a}'`,
      "stores_contact_format",
    ],
    [
      "a junk email",
      (a) => `update public.stores set contact_email = 'not-an-email' where id = '${a}'`,
      "stores_contact_format",
    ],
    [
      "markup in a product SEO title",
      (a) => `update public.products set seo_title = '<img src=x onerror=1>' where store_id = '${a}'`,
      "products_text_no_markup",
    ],
    [
      "markup in a product name",
      (a) => `update public.products set name = 'x<y' where store_id = '${a}'`,
      "products_text_no_markup",
    ],
    [
      "a non-https product image",
      () =>
        `insert into public.product_images (product_id, url) select id, 'http://x.example.com/a.jpg' from public.products limit 1`,
      "product_images_url_check",
    ],
  ];
  it.each(cases)("rejects %s", async (_label, sql, constraint) => {
    expect(await fails(sql(store.a))).toMatch(new RegExp(constraint));
  });

  it("accepts a valid Nigerian phone number, https social image and clean SEO text", async () => {
    expect(
      await fails(
        `update public.stores set contact_phone = '+234 803 123 4567', og_image_url = 'https://cdn.example.com/og.jpg', seo_title = 'Ama Hair – Buy Wigs in Abuja', seo_description = 'Shop quality wigs.' where id = '${store.a}'`,
      ),
    ).toBeNull();
  });
});
