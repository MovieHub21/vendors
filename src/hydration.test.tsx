import { act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { StaticRouter } from "react-router-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

afterEach(() => vi.restoreAllMocks());

describe("prerendered HTML hydrates cleanly", () => {
  it.each(["/", "/pricing", "/faq", "/features", "/login"])("%s", async (path) => {
    const html = renderToString(
      <HelmetProvider context={{}}>
        <StaticRouter location={path}>
          <App />
        </StaticRouter>
      </HelmetProvider>,
    );

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      hydrateRoot(
        container,
        <HelmetProvider>
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </HelmetProvider>,
      );
    });

    const mismatches = errors.mock.calls.filter((c) => /hydrat|did not match|mismatch/i.test(String(c[0])));
    expect(mismatches).toEqual([]);
    container.remove();
  });
});

describe("server-rendered vendor pages hydrate cleanly (the browser adopts the HTML the crawler saw)", () => {
  it.each(["/ama-hairs", "/ama-hairs/products/body-wave-wig", "/stores"])("%s", async (path) => {
    const { createMemoryApi } = await import("./data/publicApi");
    const { loadPageData, matchPublicRoute } = await import("./ssr/pageData");
    const { PreloadedPageContext } = await import("./ssr/PreloadedPage");
    const store = {
      id: "s1",
      slug: "ama-hairs",
      name: "Ama Hair Studio",
      description: "Quality human hair, wigs and extensions shipped across Nigeria.",
      category: "Hair & wigs",
      categorySlug: "hair-wigs",
      city: "Abuja",
      citySlug: "abuja",
      state: "FCT (Abuja)",
      stateSlug: "fct-abuja",
      isIndexable: true,
      productCount: 1,
      createdAt: "",
      updatedAt: "",
      lastModified: "",
    };
    const product = {
      id: "p1",
      storeSlug: "ama-hairs",
      slug: "body-wave-wig",
      name: "Body Wave Wig",
      description: "A soft, full body wave wig made from human hair.",
      priceKobo: 4_500_000,
      isAvailable: true,
      isIndexable: true,
      images: [{ url: "https://cdn.example.com/wig.jpg", alt: "Body wave wig", width: 1200, height: 800 }],
      createdAt: "",
      updatedAt: "",
    };
    const result = await loadPageData(
      matchPublicRoute(path)!,
      "",
      createMemoryApi({ stores: [store], products: [product] }),
    );
    if (result.status === 301) throw new Error("unexpected redirect");
    const preloaded = { path, search: "", status: result.status, data: result.data };

    const html = renderToString(
      <HelmetProvider context={{}}>
        <PreloadedPageContext.Provider value={preloaded}>
          <StaticRouter location={path}>
            <App />
          </StaticRouter>
        </PreloadedPageContext.Provider>
      </HelmetProvider>,
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      hydrateRoot(
        container,
        <HelmetProvider>
          <PreloadedPageContext.Provider value={preloaded}>
            <MemoryRouter initialEntries={[path]}>
              <App />
            </MemoryRouter>
          </PreloadedPageContext.Provider>
        </HelmetProvider>,
      );
    });
    expect(errors.mock.calls.filter((c) => /hydrat|did not match|mismatch/i.test(String(c[0])))).toEqual([]);
    container.remove();
  });
});
