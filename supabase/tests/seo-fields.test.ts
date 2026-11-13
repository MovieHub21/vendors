// @vitest-environment node
import { describe, expect, it } from "vitest";
import { HttpError } from "../functions/_shared/http.ts";
import { cleanHttpsUrl, cleanPhone, cleanText, parseStoreSeoUpdate } from "../functions/_shared/seoFields.ts";

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof HttpError ? `${e.status}:${e.code}` : String(e);
  }
  return null;
};

describe("cleanText", () => {
  it("normalises whitespace and control characters", () => {
    expect(cleanText("  Ama   Hair\u0000 Studio \n", "x", 60)).toBe("Ama Hair Studio");
  });
  it("treats empty input as 'clear this field'", () => {
    expect(cleanText("", "x", 60)).toBeNull();
    expect(cleanText("   ", "x", 60)).toBeNull();
    expect(cleanText(null, "x", 60)).toBeNull();
  });
  it.each(["<script>alert(1)</script>", "Great <b>store</b>", "a > b"])("rejects markup: %s", (v) => {
    expect(code(() => cleanText(v, "title", 60))).toBe("422:invalid_input");
  });
  it("enforces length limits", () => {
    expect(code(() => cleanText("x".repeat(61), "title", 60))).toBe("422:invalid_input");
    expect(code(() => cleanText("x", "city", 60, 2))).toBe("422:invalid_input");
    expect(code(() => cleanText(42, "title", 60))).toBe("422:invalid_input");
  });
});

describe("social image URLs", () => {
  it("accepts public https addresses", () => {
    expect(cleanHttpsUrl("https://cdn.example.com/og.jpg", "img")).toBe("https://cdn.example.com/og.jpg");
  });
  it.each([
    "http://cdn.example.com/a.jpg",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "https://localhost/a.jpg",
    "https://127.0.0.1/a.jpg",
    "https://192.168.1.5/a.jpg",
    "https://user:pass@cdn.example.com/a.jpg",
    "not a url",
    "ftp://x.example.com/a.jpg",
  ])("rejects %s", (v) => {
    expect(code(() => cleanHttpsUrl(v, "img"))).toBe("422:invalid_input");
  });
});

describe("phone", () => {
  it("accepts Nigerian formats and rejects junk", () => {
    expect(cleanPhone("+234 803 123 4567")).toBe("+234 803 123 4567");
    expect(cleanPhone("08031234567")).toBe("08031234567");
    expect(cleanPhone("")).toBeNull();
    expect(code(() => cleanPhone("call me"))).toBe("422:invalid_input");
  });
});

describe("parseStoreSeoUpdate", () => {
  it("only returns the fields that were sent", () => {
    expect(parseStoreSeoUpdate({ seo_title: "Ama Hair – Wigs in Abuja" })).toEqual({
      seo_title: "Ama Hair – Wigs in Abuja",
    });
  });
  it("clears a field when sent empty", () => {
    expect(parseStoreSeoUpdate({ seo_description: "" })).toEqual({ seo_description: null });
  });
  it("ignores fields vendors must never set (ids, owner, status, publishing, slug)", () => {
    const out = parseStoreSeoUpdate({
      seo_title: "Fine",
      owner_id: "someone-else",
      id: "x",
      status: "active",
      is_published: true,
      slug: "hijack",
    });
    expect(out).toEqual({ seo_title: "Fine" });
  });
  it("requires at least one change", () => {
    expect(code(() => parseStoreSeoUpdate({}))).toBe("422:nothing_to_update");
    expect(code(() => parseStoreSeoUpdate({ owner_id: "x" }))).toBe("422:nothing_to_update");
  });
  it("validates the indexing preference and required category", () => {
    expect(parseStoreSeoUpdate({ indexable: false })).toEqual({ indexable: false });
    expect(code(() => parseStoreSeoUpdate({ indexable: "no" }))).toBe("422:invalid_input");
    expect(code(() => parseStoreSeoUpdate({ category: "" }))).toBe("422:invalid_input");
  });
  it("rejects markup anywhere", () => {
    for (const k of ["seo_title", "seo_description", "seo_keywords", "tagline", "description", "city"]) {
      expect(
        code(() => parseStoreSeoUpdate({ [k]: "<img src=x onerror=1>" })),
        k,
      ).toBe("422:invalid_input");
    }
  });
});
