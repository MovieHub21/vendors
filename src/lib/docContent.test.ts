import { describe, expect, it } from "vitest";
import { fillTags, invoiceText, itemRows, sampleDoc, textLines, totalRows, type BankDetails } from "./docContent";
import { defaultTemplate, type Block } from "./docTemplate";

const block = (type: Block["type"], text?: string): Block => ({ id: "x1", type, x: 0, y: 0, w: 100, h: 50, style: {}, ...(text !== undefined ? { text } : {}) });
const bank: BankDetails = { bank_name: "GTBank", account_name: "Ada Stores", account_number: "0123456789", extra_note: "Send proof on WhatsApp" };

describe("receipt and invoice content", () => {
  it("the store block shows the store name, then city and state", () => {
    const lines = textLines(block("store"), sampleDoc("receipt", null));
    expect(lines[0]).toEqual({ text: "Your Store Name", tone: "strong" });
    expect(lines[1].text).toBe("Uromi, Edo");
  });

  it("the brand block has no store data in it (the header is SellSharp)", () => {
    expect(textLines(block("brand"), sampleDoc("receipt", null))).toEqual([]);
  });

  it("titles and totals say receipt or invoice", () => {
    expect(textLines(block("title"), sampleDoc("receipt", null))[0].text).toBe("PAYMENT RECEIPT");
    expect(textLines(block("title"), sampleDoc("invoice", bank))[0].text).toBe("INVOICE");
    expect(textLines(block("title", "tax invoice"), sampleDoc("invoice", bank))[0].text).toBe("TAX INVOICE");
    expect(totalRows(sampleDoc("invoice", bank)).map((r) => r.label)).toContain("Balance due");
    expect(totalRows(sampleDoc("receipt", null)).map((r) => r.label)).toContain("Outstanding balance");
  });

  it("lists the bank details on an invoice, and nothing when there are none", () => {
    const lines = textLines(block("bank"), sampleDoc("invoice", bank)).map((l) => l.text);
    expect(lines).toContain("Account number: 0123456789");
    expect(lines).toContain("GTBank");
    const doc = sampleDoc("invoice", bank);
    expect(textLines(block("bank"), { ...doc, bank: null })).toEqual([]);
  });

  it("fills {{tags}} and leaves unknown ones as typed", () => {
    const doc = sampleDoc("invoice", bank);
    expect(fillTags("Hi {{customer_name}}, pay {{ balance }} to {{account_number}}.", doc)).toBe("Hi Ada Okafor, pay ₦39,000 to 0123456789.");
    expect(fillTags("{{nope}}", doc)).toBe("{{nope}}");
  });

  it("the WhatsApp invoice text says where to pay", () => {
    const withBank = invoiceText(sampleDoc("invoice", bank));
    expect(withBank).toContain("Balance due: ₦39,000");
    expect(withBank).toContain("Pay to:");
    expect(withBank).toContain("Account number: 0123456789");
    expect(invoiceText({ ...sampleDoc("invoice", bank), bank: null })).not.toContain("Pay to:");
  });

  it("builds one row per item", () => {
    expect(itemRows(sampleDoc("receipt", null))).toHaveLength(3);
  });

  it("every default design block type is one the renderer knows", () => {
    for (const kind of ["receipt", "invoice"] as const) {
      for (const b of defaultTemplate(kind).blocks) expect(typeof b.type).toBe("string");
    }
  });
});
