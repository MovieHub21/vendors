import { render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { INDEXABLE_ROUTES } from "./lib/routes";

function Location() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

const renderAt = (path: string) =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Location />
      </MemoryRouter>
    </HelmetProvider>,
  );

const meta = (selector: string) => document.head.querySelector(selector)?.getAttribute("content") ?? null;

afterEach(() => vi.useRealTimers());

describe("static routes", () => {
  it.each([...INDEXABLE_ROUTES, "/login", "/signup", "/forgot-password"])("%s renders exactly one <h1>", (path) => {
    const { container } = renderAt(path);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("sets a unique title, canonical and index/noindex robots per page", async () => {
    renderAt("/pricing");
    await waitFor(() => expect(document.title).toBe("Pricing: ₦3,000/month, Everything Included | SellSharp"));
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toMatch(/\/pricing$/);
    expect(meta('meta[name="robots"]')).toContain("index");
    expect(meta('meta[name="robots"]')).not.toContain("noindex");
  });

  it("keeps placeholder auth pages out of search results", async () => {
    renderAt("/login");
    await waitFor(() => expect(meta('meta[name="robots"]')).toBe("noindex, nofollow"));
  });

  it("redirects the old /register URL to /signup", () => {
    renderAt("/register");
    expect(screen.getByTestId("location")).toHaveTextContent("/signup");
  });

  it("shows the forgot-password page", () => {
    renderAt("/forgot-password");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Reset your password/);
  });
});

describe("vendor storefront routes", () => {
  it("a store slug renders that vendor's store", () => {
    renderAt("/ama-hairs");
    expect(screen.getByRole("heading", { level: 1, name: "Ama Hair Studio" })).toBeInTheDocument();
    expect(screen.getByText("Silky Straight Wig")).toBeInTheDocument();
    expect(screen.getByText("₦45,000")).toBeInTheDocument();
  });

  it("marks sample stores noindex and writes store-specific tags", async () => {
    renderAt("/glow-by-ife");
    await waitFor(() => expect(document.title).toContain("Glow by Ife"));
    expect(meta('meta[name="robots"]')).toBe("noindex, nofollow");
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toMatch(/\/glow-by-ife$/);
    const ld = [...document.head.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent);
    expect(ld.some((t) => t?.includes('"OnlineStore"'))).toBe(true);
  });

  it("a real page wins over a store with the same name (static routes outrank /:storeSlug)", () => {
    renderAt("/features");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/calmer way/);
  });

  it("unknown and reserved slugs 404 and are noindex", async () => {
    for (const path of ["/no-such-store", "/admin", "/dashboard"]) {
      const { unmount } = renderAt(path);
      expect(screen.getByText(/404/)).toBeInTheDocument();
      await waitFor(() => expect(meta('meta[name="robots"]')).toBe("noindex, nofollow"));
      unmount();
    }
  });

  it("renders a product page with a Product price", () => {
    renderAt("/ama-hairs/product/body-wave-bundle");
    expect(screen.getByRole("heading", { level: 1, name: "Body Wave Bundle" })).toBeInTheDocument();
    expect(screen.getByText("₦32,000")).toBeInTheDocument();
  });

  it("an unknown product 404s", () => {
    renderAt("/ama-hairs/product/nope");
    expect(screen.getByText(/404/)).toBeInTheDocument();
  });
});

describe("dynamic text", () => {
  it.each([
    [9, "Good morning"],
    [14, "Good afternoon"],
    [20, "Good evening"],
    [2, "Working late"],
  ])("home dashboard greeting at %i:00 says %s", (hour, greeting) => {
    vi.useFakeTimers({ now: new Date(2026, 10, 11, hour, 0) });
    renderAt("/");
    expect(screen.getByRole("heading", { level: 3, name: new RegExp(`${greeting}, Amara`) })).toBeInTheDocument();
  });

  it("shows today's date, not a hard-coded one", () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 11, 10, 0) });
    renderAt("/");
    expect(screen.getByText(/WEDNESDAY 11 NOVEMBER/)).toBeInTheDocument();
  });
});

describe("theme toggle", () => {
  it("is present in the marketing header and storefronts", () => {
    renderAt("/");
    expect(screen.getAllByRole("button", { name: /Auto: follows the time of day/ }).length).toBeGreaterThan(0);
    document.body.innerHTML = "";
    renderAt("/ama-hairs");
    expect(screen.getAllByRole("button", { name: /Auto: follows the time of day/ }).length).toBeGreaterThan(0);
  });
});
