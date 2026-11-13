// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fakePostgrest, sqlRows } from "../test/fakePostgrest";
import { cleanSearchTerm, createRestApi, isSafeSlug } from "./publicApi";

const api = () => {
  const pg = fakePostgrest(sqlRows);
  return { pg, api: createRestApi({ url: "https://proj.supabase.co/", key: "sb_publishable_x", fetch: pg.fetch }) };
};

describe("REST public API maps the database views correctly", () => {
  it("getStore", async () => {
    const store = await api().api.getStore("ama-hairs");
    expect(store).toMatchObject({
      slug: "ama-hairs",
      name: "Ama Hair Studio",
      categorySlug: "hair-wigs",
      stateSlug: "fct-abuja",
      isIndexable: true,
      productCount: 2,
      coverUrl: "https://cdn.example.com/cover.jpg",
    });
    expect(store?.logoUrl).toBeUndefined(); // null columns become "absent", not the string "null"
  });
  it("getProduct needs BOTH slugs, so a product is only found under the store that owns it", async () => {
    const { api: a, pg } = api();
    expect((await a.getProduct("ama-hairs", "body-wave-wig"))?.images[0]).toEqual({
      url: "https://cdn.example.com/wig.jpg",
      alt: "Body wave wig",
      width: 1200,
      height: 800,
    });
    expect(await a.getProduct("empty-shop", "body-wave-wig")).toBeNull();
    expect(pg.calls[0]).toContain("store_slug=eq.ama-hairs");
    expect(pg.calls[0]).toContain("slug=eq.body-wave-wig");
  });
  it("redirects, facets, sitemaps and counts", async () => {
    const a = api().api;
    expect(await a.getProductRedirect("ama-hairs", "old-wig")).toBe("body-wave-wig");
    expect(await a.directoryFacets()).toEqual([
      { kind: "category", slug: "hair-wigs", name: "Hair & wigs", storeCount: 1 },
      { kind: "state", slug: "fct-abuja", name: "FCT (Abuja)", storeCount: 1 },
      { kind: "city", slug: "abuja", name: "Abuja", storeCount: 1 },
    ]);
    expect(await a.sitemapStores(0, 10)).toEqual([{ slug: "ama-hairs", lastModified: "2026-11-03T00:00:00Z" }]);
    expect(await a.sitemapProducts(0, 10)).toEqual([
      { storeSlug: "ama-hairs", slug: "body-wave-wig", lastModified: "2026-11-04T00:00:00Z" },
    ]);
    expect(await a.sitemapProductCount()).toBe(1);
  });
  it("sends the publishable key only, never anything else", async () => {
    const seen: Array<Record<string, string>> = [];
    const f = (async (_u: unknown, init?: RequestInit) => {
      seen.push(Object.fromEntries(new Headers(init?.headers)));
      return new Response("[]");
    }) as unknown as typeof fetch;
    await createRestApi({ url: "https://p.supabase.co", key: "sb_publishable_x", fetch: f }).getStore("x-shop");
    expect(seen[0]).toMatchObject({ apikey: "sb_publishable_x", authorization: "Bearer sb_publishable_x" });
  });
  it("turns an API failure into an error (so the page becomes a 503, not a 404)", async () => {
    const f = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    await expect(
      createRestApi({ url: "https://p.supabase.co", key: "k", fetch: f }).getStore("ama-hairs"),
    ).rejects.toThrow(/failed/);
  });
});

describe("query injection is not possible", () => {
  it.each([
    "a,or=(id.gt.0)",
    "x&select=owner_id",
    "../etc",
    "ama hairs",
    "UPPER",
    "a--b",
    "",
    "x".repeat(81),
    "ama-hairs.json",
    "ama%2Chairs",
  ])("%j never reaches the API", async (evil) => {
    const { api: a, pg } = api();
    expect(isSafeSlug(evil)).toBe(false);
    expect(await a.getStore(evil)).toBeNull();
    expect(await a.getProduct("ama-hairs", evil)).toBeNull();
    expect(await a.getProductRedirect("ama-hairs", evil)).toBeNull();
    expect(await a.listProducts(evil)).toEqual([]);
    expect(pg.calls).toEqual([]);
  });
  it("search terms are reduced to letters, digits, spaces and hyphens", () => {
    expect(cleanSearchTerm("Ama*&select=owner_id  Hair")).toBe("ama select owner id hair");
    expect(cleanSearchTerm("x".repeat(100))).toHaveLength(40);
  });
  it("demo API lists available sample stores and facets so directory is never empty", async () => {
    const { createDemoApi } = await import("./publicApi");
    const demo = createDemoApi();
    const stores = await demo.listStores();
    expect(stores.length).toBeGreaterThanOrEqual(3);
    expect(stores.map((s) => s.slug)).toContain("ama-hairs");

    const facets = await demo.directoryFacets();
    expect(facets.length).toBeGreaterThan(0);
    expect(facets.map((f) => f.slug)).toContain("hair-wigs");
  });
});
