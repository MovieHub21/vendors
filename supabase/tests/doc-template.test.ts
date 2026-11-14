// @vitest-environment node
import { describe, expect, it } from "vitest";
import { HttpError } from "../functions/_shared/http.ts";
import { hasPaymentDetails, parsePaymentDetails } from "../functions/_shared/paymentDetails.ts";
import {
  BLOCK_PRESETS,
  defaultTemplate,
  MAX_BLOCKS,
  newBlock,
  PAGE_H,
  pageStarts,
  resolveLayout,
  tableHeadHeight,
  tableRowHeight,
  TemplateError,
  templateToCss,
  validateTemplate,
  type Block,
  type Template,
} from "../functions/_shared/docTemplate.ts";

const reject = (input: unknown) => {
  try {
    validateTemplate(input);
  } catch (e) {
    return e instanceof TemplateError ? e.message : String(e);
  }
  return null;
};
const block = (extra: Record<string, unknown> = {}) => ({ id: "a1", type: "text", x: 10, y: 10, w: 100, h: 30, style: {}, ...extra });
const withBlocks = (...blocks: unknown[]) => ({ version: 1, background: "#ffffff", blocks });
const DANGEROUS = /[<>\\@]|url\s*\(|expression|javascript/i;

describe("built-in designs", () => {
  for (const kind of ["receipt", "invoice"] as const) {
    it(`${kind}: validates unchanged and produces clean CSS`, () => {
      const t = defaultTemplate(kind);
      expect(validateTemplate(JSON.parse(JSON.stringify(t)))).toEqual(t);
      expect(DANGEROUS.test(templateToCss(t))).toBe(false);
    });
  }

  it("the header is SellSharp and the store block carries the store name with city and state", () => {
    const types = defaultTemplate("receipt").blocks.map((b) => b.type);
    expect(types).toContain("brand");
    expect(types).toContain("store");
  });

  it("only invoices carry bank details, only receipts carry the payment history", () => {
    const receipt = defaultTemplate("receipt").blocks.map((b) => b.type);
    const invoice = defaultTemplate("invoice").blocks.map((b) => b.type);
    expect(receipt).toContain("payments");
    expect(receipt).not.toContain("bank");
    expect(invoice).toContain("bank");
  });
});

describe("validateTemplate", () => {
  it("turns placement into CSS", () => {
    const css = templateToCss(validateTemplate(withBlocks(block({ id: "box1", type: "box", x: 12, y: 34, w: 200, h: 80, style: { bg: "#FFAA00", radius: 8 } }))));
    expect(css).toContain(".doc-tpl .b-box1{left:12px;top:34px;width:200px;height:80px;background:#ffaa00;");
    expect(css).toContain("border-radius:8px");
  });

  it.each([
    ["an id that could break out of a selector", withBlocks(block({ id: "a b{}" }))],
    ["an unknown block type", withBlocks(block({ type: "script" }))],
    ["a colour that smuggles in extra CSS", withBlocks(block({ style: { color: "red;}body{display:none" } }))],
    ["a url() colour", withBlocks(block({ style: { bg: "url(https://evil.test/x)" } }))],
    ["a javascript: image", withBlocks(block({ type: "image", src: "javascript:alert(1)" }))],
    ["an image link with brackets", withBlocks(block({ type: "image", src: "https://x.test/a.png?x=1)" }))],
    ["an http image link", withBlocks(block({ type: "image", src: "http://x.test/a.png" }))],
    ["an unknown font", withBlocks(block({ style: { font: "Comic Sans; color:red" } }))],
    ["duplicate ids", withBlocks(block(), block())],
    ["no blocks", withBlocks()],
    ["a non-object", "nope"],
    ["a non-number position", withBlocks(block({ x: "10" }))],
  ])("rejects %s", (_name, input) => {
    expect(reject(input)).not.toBeNull();
  });

  it(`allows at most ${MAX_BLOCKS} blocks`, () => {
    const many = Array.from({ length: MAX_BLOCKS + 1 }, (_, i) => block({ id: `b${i}` }));
    expect(reject(withBlocks(...many))).toContain("at most");
  });

  it("keeps blocks on the page and ignores style keys it doesn't know", () => {
    const [b] = validateTemplate(withBlocks(block({ x: 5000, y: -20, w: 9999, h: 99999, style: { fontSize: 500, evil: "x" } }))).blocks;
    expect(b.x + b.w).toBeLessThanOrEqual(794);
    expect(b.y).toBe(0);
    expect(b.y + b.h).toBeLessThanOrEqual(PAGE_H);
    expect(b.style).toEqual({ fontSize: 72 });
  });

  it("free text can say anything but never reaches the CSS", () => {
    const t = validateTemplate(withBlocks(block({ text: "</style><script>alert(1)</script> {{balance}}" })));
    expect(t.blocks[0].text).toContain("<script>");
    expect(templateToCss(t)).not.toContain("script");
  });

  it("newBlock starts every block type inside the page", () => {
    for (const type of Object.keys(BLOCK_PRESETS) as (keyof typeof BLOCK_PRESETS)[]) {
      const b = newBlock(type, "n1", 700, 1100);
      expect(() => validateTemplate(withBlocks(b))).not.toThrow();
    }
  });
});

describe("a long order", () => {
  const t: Template = defaultTemplate("receipt");
  const items = t.blocks.find((b) => b.type === "items") as Block;
  const rowH = tableRowHeight(12);

  it("pushes everything under the table down by exactly the extra height, and leaves what is above alone", () => {
    const small = resolveLayout(t, { items: 1, payments: 1 });
    const big = resolveLayout(t, { items: 15, payments: 1 });
    const extra = tableHeadHeight(12) + 15 * rowH - items.h;
    const at = (r: typeof big, id: string) => r.blocks.find((x) => x.block.id === id)!;
    expect(at(big, "items").h).toBe(items.h + extra);
    expect(at(big, "totals").y).toBe(at(small, "totals").y + extra);
    expect(at(big, "footer").y).toBe(at(small, "footer").y + extra);
    expect(at(big, "customer").y).toBe(at(small, "customer").y);
    expect(at(big, "brand").y).toBe(at(small, "brand").y);
  });

  it("does not move anything when the order fits the designed table", () => {
    const r = resolveLayout(t, { items: 3, payments: 1 });
    expect(r.blocks.every((x) => x.y === x.block.y && x.h === x.block.h)).toBe(true);
    expect(r.height).toBe(PAGE_H);
  });

  it("makes a box that wraps the table taller as well", () => {
    const wrapped: Template = {
      ...t,
      blocks: [{ id: "card", type: "box", x: 40, y: 320, w: 714, h: 240, style: { bg: "#eeeeee" } }, ...t.blocks],
    };
    const r = resolveLayout(wrapped, { items: 15, payments: 1 });
    const card = r.blocks.find((x) => x.block.id === "card")!;
    const table = r.blocks.find((x) => x.block.id === "items")!;
    expect(card.y + card.h).toBeGreaterThanOrEqual(table.y + table.h);
  });

  it("starts a new page between rows, never through one", () => {
    const r = resolveLayout(t, { items: 40, payments: 1 });
    expect(r.height).toBeGreaterThan(PAGE_H);
    const starts = pageStarts(r.blocks, r.height);
    expect(starts.length).toBeGreaterThan(1);
    const tableTop = r.blocks.find((x) => x.block.id === "items")!.y + tableHeadHeight(12);
    for (const start of starts.slice(1)) {
      if (start > tableTop && start < tableTop + 40 * rowH) expect((start - tableTop) % rowH).toBe(0);
    }
  });
});

describe("bank / payment details", () => {
  const code = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      return e instanceof HttpError ? `${e.status}:${e.code}` : String(e);
    }
    return null;
  };

  it("trims, tidies spaces and turns blanks into null", () => {
    expect(parsePaymentDetails({ bank_name: "  GT   Bank ", account_name: "", account_number: "0123456789", extra_note: undefined })).toEqual({
      bank_name: "GT Bank",
      account_name: null,
      account_number: "0123456789",
      extra_note: null,
    });
  });

  it("knows when nothing was entered", () => {
    expect(hasPaymentDetails(parsePaymentDetails({}))).toBe(false);
    expect(hasPaymentDetails(parsePaymentDetails({ bank_name: "Opay" }))).toBe(true);
  });

  it.each([
    [{ account_number: "12" }, "422:invalid_payment_details"],
    [{ account_number: "1234 <script>" }, "422:invalid_payment_details"],
    [{ bank_name: "<b>Bank</b>" }, "422:invalid_payment_details"],
    [{ extra_note: "x".repeat(301) }, "422:invalid_payment_details"],
    [{ bank_name: 123 }, "422:invalid_payment_details"],
  ])("rejects %j", (body, expected) => {
    expect(code(() => parsePaymentDetails(body as Record<string, unknown>))).toBe(expected);
  });
});
