import { describe, expect, it } from "vitest";
import { ALL_STATIC_ROUTES } from "./routes";
import { isReservedSlug, slugify, validateStoreSlug } from "./reservedSlugs";

describe("reserved store slugs", () => {
  it("reserves the first segment of every static route", () => {
    for (const route of ALL_STATIC_ROUTES.filter((r) => r !== "/")) {
      expect(isReservedSlug(route.split("/")[1]), route).toBe(true);
    }
  });

  it("reserves system and future areas", () => {
    for (const word of ["admin", "api", "login", "register", "signup", "forgot-password", "dashboard", "checkout"]) {
      expect(validateStoreSlug(word)).toEqual({ ok: false, reason: "reserved" });
    }
  });

  it("is case-insensitive", () => {
    expect(validateStoreSlug("PRICING")).toEqual({ ok: false, reason: "reserved" });
  });
});

describe("validateStoreSlug", () => {
  it("accepts normal usernames", () => {
    expect(validateStoreSlug("ama-hairs")).toEqual({ ok: true, slug: "ama-hairs" });
    expect(validateStoreSlug("  Glow-By-Ife ")).toEqual({ ok: true, slug: "glow-by-ife" });
    expect(validateStoreSlug("shop247")).toEqual({ ok: true, slug: "shop247" });
  });

  it.each([
    ["ab", "too_short"],
    ["a".repeat(31), "too_long"],
    ["ama hairs", "invalid_characters"],
    ["ama_hairs", "invalid_characters"],
    ["-ama", "invalid_characters"],
    ["ama-", "invalid_characters"],
    ["ama--hairs", "invalid_characters"],
    ["ama.hairs", "invalid_characters"],
    ["amá-hairs", "invalid_characters"],
  ])("rejects %s", (input, reason) => {
    expect(validateStoreSlug(input)).toEqual({ ok: false, reason });
  });
});

describe("slugify", () => {
  it("turns business names into slugs", () => {
    expect(slugify("Ama's Hair Studio!")).toBe("amas-hair-studio");
    expect(slugify("  Glow  by   Ifé ")).toBe("glow-by-ife");
  });
});
