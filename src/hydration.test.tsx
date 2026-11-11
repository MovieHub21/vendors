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
