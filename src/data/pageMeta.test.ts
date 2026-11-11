import { describe, expect, it } from "vitest";
import { fullTitle } from "../lib/seo";
import { PAGE_META } from "./pageMeta";

describe("page metadata", () => {
  for (const [key, meta] of Object.entries(PAGE_META)) {
    it(`${key}: title ≤ 60 chars and description 70–160 chars`, () => {
      expect(fullTitle(meta).length).toBeLessThanOrEqual(60);
      if (key !== "notFound") {
        expect(meta.description.length).toBeGreaterThanOrEqual(70);
        expect(meta.description.length).toBeLessThanOrEqual(160);
      }
    });
  }

  it("uses unique titles and descriptions", () => {
    const metas = Object.values(PAGE_META);
    expect(new Set(metas.map((m) => fullTitle(m))).size).toBe(metas.length);
    expect(new Set(metas.map((m) => m.description)).size).toBe(metas.length);
  });
});
