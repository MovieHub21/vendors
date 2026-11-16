import { describe, expect, it } from "vitest";
import {
  CONTENT_W,
  layoutReport,
  PAGE_H,
  PAGE_W,
  wrapText,
  type Block,
  type Measure,
  type Op,
  type Page,
} from "./reportLayout";

const measure: Measure = (text) => text.length * 10; // every character is 10px wide
const run = (blocks: Block[]): Page[] => layoutReport(blocks, measure, { footerText: "Ama Hair · SellSharp export" });
const texts = (p: Page) => p.ops.filter((o): o is Extract<Op, { k: "text" }> => o.k === "text");
const bodyTexts = (p: Page) => texts(p).filter((o) => o.y < PAGE_H - 100); // everything above the footer
const rows = (n: number): string[][] => Array.from({ length: n }, (_, i) => [`Product ${i}`, "Hair", "₦1,000"]);
const table = (n: number): Block => ({
  type: "table",
  columns: [
    { label: "Product", weight: 3 },
    { label: "Category", weight: 1 },
    { label: "Price", weight: 1, align: "right" },
  ],
  rows: rows(n),
});

describe("wrapText", () => {
  it("wraps on spaces within the width", () => {
    expect(wrapText("one two three four", 90, "f", measure)).toEqual(["one two", "three", "four"]);
  });
  it("breaks a word that is wider than the whole line instead of overflowing", () => {
    const lines = wrapText("a".repeat(25), 100, "f", measure);
    expect(lines).toEqual(["a".repeat(10), "a".repeat(10), "a".repeat(5)]);
  });
  it("keeps explicit new lines and always returns something", () => {
    expect(wrapText("Facebook: x\nInstagram: y", 1000, "f", measure)).toEqual(["Facebook: x", "Instagram: y"]);
    expect(wrapText("", 100, "f", measure)).toEqual([""]);
  });
});

describe("pagination", () => {
  it("a short report is one page with a footer and page number", () => {
    const pages = run([{ type: "h2", text: "Products" }, table(3)]);
    expect(pages).toHaveLength(1);
    const foot = texts(pages[0]).map((t) => t.text);
    expect(foot).toContain("Ama Hair · SellSharp export");
    expect(foot).toContain("Page 1 of 1");
  });

  it("a long table flows onto more pages and every page is numbered 'of N'", () => {
    const pages = run([{ type: "h2", text: "Products" }, table(200)]);
    expect(pages.length).toBeGreaterThan(3);
    pages.forEach((p, i) => expect(texts(p).map((t) => t.text)).toContain(`Page ${i + 1} of ${pages.length}`));
  });

  it("repeats the table header at the top of every page the table touches", () => {
    const pages = run([table(200)]);
    pages.forEach((p) => expect(bodyTexts(p).filter((t) => t.text === "Product")).toHaveLength(1));
  });

  it("never draws below the bottom margin or outside the side margins", () => {
    const pages = run([{ type: "h2", text: "Products" }, table(150), { type: "text", text: "word ".repeat(400) }]);
    for (const p of pages) {
      for (const t of bodyTexts(p)) {
        expect(t.y).toBeLessThan(PAGE_H - 140 + 1);
        if (t.align === "right") expect(t.x).toBeLessThanOrEqual(PAGE_W - 100);
        else expect(t.x + t.text.length * 10).toBeLessThanOrEqual(PAGE_W - 100 + 1);
      }
    }
  });

  it("a very long paragraph splits across pages without losing a line", () => {
    const text = Array.from({ length: 300 }, (_, i) => `line${i}`).join("\n");
    const pages = run([{ type: "text", text }]);
    expect(pages.length).toBeGreaterThan(1);
    const drawn = pages.flatMap((p) => bodyTexts(p).map((t) => t.text));
    for (let i = 0; i < 300; i++) expect(drawn).toContain(`line${i}`);
  });

  it("a section marked pageBreak starts a new page", () => {
    const pages = run([
      { type: "text", text: "cover" },
      { type: "h2", text: "Customers", pageBreak: true },
    ]);
    expect(pages).toHaveLength(2);
    expect(bodyTexts(pages[1]).map((t) => t.text)).toContain("Customers");
  });

  it("a heading is never left alone at the bottom of a page", () => {
    // fill the page almost to the bottom, then add a heading followed by a table
    const filler: Block = { type: "gap", px: 1440 };
    const pages = run([filler, { type: "h2", text: "Orders" }, table(5)]);
    expect(pages).toHaveLength(2);
    expect(bodyTexts(pages[0]).map((t) => t.text)).not.toContain("Orders");
    expect(bodyTexts(pages[1]).map((t) => t.text)).toContain("Orders");
  });

  it("keeps a group (one order card) together on one page when it fits", () => {
    const card: Block = {
      type: "group",
      blocks: [
        { type: "h3", left: "ORD-1" },
        {
          type: "facts",
          items: [
            { label: "Customer", value: "Ama" },
            { label: "Status", value: "paid" },
          ],
        },
        table(4),
      ],
    };
    const pages = run([{ type: "gap", px: 1300 }, card]);
    const page2 = bodyTexts(pages[1]).map((t) => t.text);
    expect(pages).toHaveLength(2);
    expect(page2).toContain("ORD-1");
    expect(bodyTexts(pages[0]).map((t) => t.text)).not.toContain("ORD-1");
  });

  it("shows a message instead of an empty table", () => {
    const pages = run([
      { type: "table", columns: [{ label: "A", weight: 1 }], rows: [], emptyText: "No orders recorded" },
    ]);
    expect(bodyTexts(pages[0]).map((t) => t.text)).toContain("No orders recorded");
  });

  it("wraps long cell text inside its column", () => {
    const pages = run([
      {
        type: "table",
        columns: [
          { label: "Details", weight: 1 },
          { label: "Qty", weight: 1 },
        ],
        rows: [["x".repeat(300), "2"]],
      },
    ]);
    const cells = bodyTexts(pages[0]).filter((t) => /^x+$/.test(t.text));
    expect(cells.length).toBeGreaterThan(1);
    for (const c of cells) expect(c.text.length * 10).toBeLessThanOrEqual(CONTENT_W / 2);
  });

  it("right-aligns money columns", () => {
    const pages = run([table(1)]);
    const price = bodyTexts(pages[0]).find((t) => t.text === "₦1,000")!;
    expect(price.align).toBe("right");
  });
});
