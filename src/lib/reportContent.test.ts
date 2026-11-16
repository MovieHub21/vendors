import { describe, expect, it } from "vitest";
import { buildReportBlocks, type ReportData, type Row } from "./reportContent";
import type { Block } from "./reportLayout";

const store: Row = {
  name: "Ama Hair Studio",
  slug: "ama-hairs",
  category: "Hair & wigs",
  city: "Lagos",
  state: "Lagos",
  contact_phone: "+234 803 123 4567",
  instagram_url: "https://instagram.com/amahair",
};
const data: ReportData = {
  customers: [
    {
      id: "c1",
      name: "Ọlá Adéṣínà",
      phone: "0803",
      email: null,
      address: "Ikeja",
      created_at: "2026-10-01T09:00:00Z",
      order_count: 1,
      total_purchases_kobo: 9000000,
      total_paid_kobo: 4000000,
      outstanding_kobo: 5000000,
    },
  ],
  products: [
    {
      id: "p1",
      slug: "wig",
      name: "Body Wave Wig",
      description: "Soft wig",
      price_kobo: 4500000,
      category: "Hair",
      status: "published",
      is_available: true,
      stock_quantity: null,
      created_at: "2026-09-01T00:00:00Z",
      product_images: [{ url: "https://cdn.example.com/w.jpg" }],
    },
  ],
  orders: [
    {
      id: "o1",
      customer_id: "c1",
      reference: "ORD-1001",
      channel: "whatsapp",
      status: "delivered",
      total_kobo: 9000000,
      paid_kobo: 4000000,
      payment_status: "part_paid",
      delivery_address: "Wuse 2",
      notes: null,
      created_at: "2026-11-02T14:20:00Z",
    },
  ],
  items: [
    {
      id: "i1",
      order_id: "o1",
      product_name: "Body Wave Wig",
      variant: "24in",
      unit_price_kobo: 4500000,
      quantity: 2,
      line_total_kobo: 9000000,
    },
  ],
  payments: [
    {
      id: "x1",
      order_id: "o1",
      amount_kobo: 4000000,
      method: "bank_transfer",
      source: "manual",
      note: null,
      recorded_at: "2026-11-02T16:00:00Z",
    },
  ],
  receipts: [],
};
const all = (blocks: Block[]): Block[] => blocks.flatMap((b) => (b.type === "group" ? [b, ...all(b.blocks)] : [b]));
const text = (blocks: Block[]) => JSON.stringify(blocks);

describe("buildReportBlocks", () => {
  const blocks = buildReportBlocks(store, data, new Date("2026-11-15T12:00:00Z"));

  it("keeps everything the old print report contained", () => {
    const t = text(blocks);
    for (const must of [
      "Ama Hair Studio",
      "ORD-1001",
      "Ọlá Adéṣínà",
      "Body Wave Wig",
      "bank_transfer",
      "Instagram: https://instagram.com/amahair",
      "https://cdn.example.com/w.jpg",
    ]) {
      expect(t, must).toContain(must);
    }
  });

  it("shows money in naira with the ₦ sign, from integer kobo", () => {
    const t = text(blocks);
    expect(t).toContain("₦45,000");
    expect(t).toContain("₦90,000");
    expect(t).toContain("₦50,000"); // outstanding
  });

  it("summarises the store on the cover", () => {
    const stats = blocks.find((b) => b.type === "stats") as Extract<Block, { type: "stats" }>;
    expect(stats.items).toEqual([
      { label: "Products", value: "1" },
      { label: "Customers", value: "1" },
      { label: "Orders", value: "1" },
      { label: "Order value", value: "₦90,000" },
      { label: "Recorded payments", value: "₦40,000" },
      { label: "Receipts", value: "0" },
    ]);
  });

  it("links each order to its own items and payments", () => {
    const order = all(blocks).find((b) => b.type === "group" && JSON.stringify(b).includes("ORD-1001"))!;
    const tables = all([order]).filter((b): b is Extract<Block, { type: "table" }> => b.type === "table");
    expect(tables[0].rows).toEqual([["Body Wave Wig", "24in", "2", "₦45,000", "₦90,000"]]);
    expect(tables[1].rows[0]).toEqual(expect.arrayContaining(["bank_transfer", "manual", "₦40,000"]));
  });

  it("says so when a section is empty instead of leaving it blank", () => {
    const empty = buildReportBlocks(store, {
      customers: [],
      products: [],
      orders: [],
      items: [],
      payments: [],
      receipts: [],
    });
    const t = text(empty);
    for (const m of ["No products recorded", "No customers recorded.", "No orders recorded.", "No receipts recorded."])
      expect(t).toContain(m);
  });

  it("every section starts on a new page, and each card is kept together", () => {
    expect(blocks.filter((b) => b.type === "h2" && b.pageBreak).length).toBe(5);
    expect(blocks.filter((b) => b.type === "group").length).toBe(2);
  });
});
