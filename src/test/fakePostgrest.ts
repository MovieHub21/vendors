/** A tiny stand-in for Supabase's PostgREST: understands eq./ilike. filters, order, limit, offset and count — enough to test our queries. */
type Row = Record<string, unknown>;

export function fakePostgrest(views: Record<string, Row[]>) {
  const calls: string[] = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    calls.push(url.pathname + url.search);
    const view = url.pathname.replace("/rest/v1/", "");
    if (!(view in views)) return new Response(JSON.stringify({ message: "relation does not exist" }), { status: 404 });
    let rows = [...views[view]];
    for (const [key, value] of url.searchParams) {
      if (["select", "order", "limit", "offset"].includes(key)) continue;
      if (value.startsWith("eq.")) rows = rows.filter((r) => String(r[key]) === value.slice(3));
      else if (value.startsWith("ilike.")) {
        const needle = value.slice(6).replace(/\*/g, "").toLowerCase();
        rows = rows.filter((r) => String(r[key]).toLowerCase().includes(needle));
      } else throw new Error(`fake PostgREST: unsupported filter ${key}=${value}`);
    }
    const total = rows.length;
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = url.searchParams.get("limit");
    rows = rows.slice(offset, limit ? offset + Number(limit) : undefined);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (new Headers(init?.headers).get("Prefer")?.includes("count=exact")) headers["Content-Range"] = `0-0/${total}`;
    return new Response(JSON.stringify(rows), { status: 200, headers });
  };
  return { fetch: fetchImpl as typeof fetch, calls };
}

/** Rows shaped exactly like the SQL views in supabase/migrations/…0500_seo.sql. */
export const sqlRows = {
  public_stores: [
    {
      id: "s1",
      slug: "ama-hairs",
      name: "Ama Hair Studio",
      tagline: "Quality wigs",
      description: "Quality human hair, wigs and extensions shipped across Nigeria.",
      category: "Hair & wigs",
      category_slug: "hair-wigs",
      city: "Abuja",
      city_slug: "abuja",
      state: "FCT (Abuja)",
      state_slug: "fct-abuja",
      logo_url: null,
      cover_url: "https://cdn.example.com/cover.jpg",
      og_image_url: null,
      seo_title: null,
      seo_description: null,
      is_indexable: true,
      product_count: 2,
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-02T00:00:00Z",
      last_modified: "2026-11-03T00:00:00Z",
    },
    {
      id: "s2",
      slug: "empty-shop",
      name: "Empty Shop",
      tagline: null,
      description: "Short.",
      category: "Other",
      category_slug: "other",
      city: null,
      city_slug: "",
      state: "Lagos",
      state_slug: "lagos",
      logo_url: null,
      cover_url: null,
      og_image_url: null,
      seo_title: null,
      seo_description: null,
      is_indexable: false,
      product_count: 0,
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-02T00:00:00Z",
      last_modified: "2026-11-02T00:00:00Z",
    },
  ],
  public_products: [
    {
      id: "p1",
      store_slug: "ama-hairs",
      slug: "body-wave-wig",
      name: "Body Wave Wig",
      description: "A soft, full body wave wig made from human hair.",
      price_kobo: 4500000,
      is_available: true,
      category: null,
      seo_title: null,
      seo_description: null,
      og_image_url: null,
      is_indexable: true,
      created_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-04T00:00:00Z",
      images: [{ url: "https://cdn.example.com/wig.jpg", alt: "Body wave wig", width: 1200, height: 800 }],
    },
  ],
  public_product_redirects: [{ store_slug: "ama-hairs", old_slug: "old-wig", new_slug: "body-wave-wig" }],
  public_directory_categories: [{ slug: "hair-wigs", name: "Hair & wigs", store_count: 1 }],
  public_directory_locations: [
    { kind: "state", slug: "fct-abuja", name: "FCT (Abuja)", store_count: 1 },
    { kind: "city", slug: "abuja", name: "Abuja", store_count: 1 },
  ],
  sitemap_stores: [{ slug: "ama-hairs", last_modified: "2026-11-03T00:00:00Z" }],
  sitemap_products: [{ store_slug: "ama-hairs", slug: "body-wave-wig", last_modified: "2026-11-04T00:00:00Z" }],
} satisfies Record<string, Row[]>;
