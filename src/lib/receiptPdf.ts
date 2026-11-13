import { formatNaira } from "./money";
import { channelLabel, methodLabel, type ReceiptSnapshot } from "./sales";

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const SCALE = 2;
const LEFT = 58;
const RIGHT = PAGE_WIDTH - LEFT;
const FONT = "'DM Sans Variable', 'DM Sans', Arial, sans-serif";
const DISPLAY_FONT = "'Manrope Variable', Manrope, Arial, sans-serif";

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, color: string, font: string) {
  ctx.fillStyle = color;
  ctx.font = font;
  const lines = wrap(ctx, value, width);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * 20));
  return lines.length * 20;
}

function rule(ctx: CanvasRenderingContext2D, y: number) {
  ctx.strokeStyle = "#e8ebf1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(LEFT, y);
  ctx.lineTo(RIGHT, y);
  ctx.stroke();
}

function makePage(snapshot: ReceiptSnapshot, receiptNo: string, revision: number, continued: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH * SCALE;
  canvas.height = PAGE_HEIGHT * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("PDF drawing is unavailable in this browser.");
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  ctx.fillStyle = "#172b43";
  ctx.fillRect(0, 0, PAGE_WIDTH, 8);

  text(ctx, continued ? "RECEIPT · CONTINUED" : "PAYMENT RECEIPT", LEFT, 54, 330, "#826bbd", `800 11px ${FONT}`);
  text(ctx, snapshot.business.name, LEFT, 88, 425, "#172337", `800 25px ${DISPLAY_FONT}`);
  const contact = [snapshot.business.city, snapshot.business.state, snapshot.business.phone, snapshot.business.email].filter(Boolean).join(" · ");
  text(ctx, contact || "", LEFT, 118, 440, "#718095", `400 12px ${FONT}`);

  ctx.fillStyle = "#f4f2fb";
  ctx.fillRect(540, 43, 196, 84);
  text(ctx, `RECEIPT ${receiptNo}`, 556, 69, 164, "#523f83", `800 11px ${FONT}`);
  text(ctx, `Order ${snapshot.order.reference}`, 556, 91, 164, "#25354a", `600 12px ${FONT}`);
  text(ctx, revision > 1 ? `Updated · v${revision}` : "Original", 556, 113, 164, "#718095", `500 11px ${FONT}`);

  let y = 154;
  if (!continued) {
    ctx.fillStyle = "#f7f8fb";
    ctx.fillRect(LEFT, y, RIGHT - LEFT, 112);
    text(ctx, "BILLED TO", LEFT + 16, y + 24, 290, "#718095", `800 10px ${FONT}`);
    text(ctx, snapshot.customer.name, LEFT + 16, y + 48, 300, "#172337", `700 15px ${FONT}`);
    const customerContact = [snapshot.customer.phone, snapshot.customer.email, snapshot.customer.address].filter(Boolean).join(" · ");
    text(ctx, customerContact || "Customer", LEFT + 16, y + 71, 315, "#718095", `400 11px ${FONT}`);
    text(ctx, "ORDER DETAILS", 415, y + 24, 280, "#718095", `800 10px ${FONT}`);
    text(ctx, channelLabel(snapshot.order.channel), 415, y + 48, 280, "#172337", `700 14px ${FONT}`);
    text(ctx, new Date(snapshot.order.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), 415, y + 71, 280, "#718095", `400 11px ${FONT}`);
    y += 142;
  }

  drawTableHead(ctx, y);
  return { canvas, ctx, y: y + 42 };
}

function drawTableHead(ctx: CanvasRenderingContext2D, y: number) {
  ctx.fillStyle = "#172b43";
  ctx.fillRect(LEFT, y, RIGHT - LEFT, 34);
  text(ctx, "ITEM", LEFT + 12, y + 22, 350, "#ffffff", `700 10px ${FONT}`);
  text(ctx, "QTY", 480, y + 22, 44, "#ffffff", `700 10px ${FONT}`);
  text(ctx, "PRICE", 540, y + 22, 78, "#ffffff", `700 10px ${FONT}`);
  text(ctx, "AMOUNT", 630, y + 22, 92, "#ffffff", `700 10px ${FONT}`);
}

function jpegBytes(canvas: HTMLCanvasElement): Uint8Array {
  const encoded = canvas.toDataURL("image/jpeg", 0.94).split(",")[1];
  const raw = atob(encoded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const ascii = (value: string) => new TextEncoder().encode(value);
function join(chunks: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(chunks.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of chunks) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function pdfFromPages(pages: HTMLCanvasElement[]): Blob {
  const objects: Uint8Array[] = [];
  objects[1] = ascii("<< /Type /Catalog /Pages 2 0 R >>");
  const pageNumbers = pages.map((_, index) => 3 + index * 3);
  objects[2] = ascii(`<< /Type /Pages /Kids [${pageNumbers.map((n) => `${n} 0 R`).join(" ")}] /Count ${pages.length} >>`);

  pages.forEach((canvas, index) => {
    const pageNumber = pageNumbers[index];
    const imageNumber = pageNumber + 1;
    const streamNumber = pageNumber + 2;
    const image = jpegBytes(canvas);
    const content = ascii("q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n");
    objects[pageNumber] = ascii(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imageNumber} 0 R >> >> /Contents ${streamNumber} 0 R >>`,
    );
    objects[imageNumber] = join([
      ascii(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`),
      image,
      ascii("\nendstream"),
    ]);
    objects[streamNumber] = join([ascii(`<< /Length ${content.length} >>\nstream\n`), content, ascii("endstream")]);
  });

  const chunks: Uint8Array[] = [ascii("%PDF-1.4\n%SellSharp\n")];
  const offsets = [0];
  let length = chunks[0].length;
  for (let number = 1; number < objects.length; number++) {
    const entry = join([ascii(`${number} 0 obj\n`), objects[number], ascii("\nendobj\n")]);
    offsets[number] = length;
    chunks.push(entry);
    length += entry.length;
  }
  const xrefOffset = length;
  const xref = ["xref", `0 ${objects.length}`, "0000000000 65535 f "];
  for (let number = 1; number < objects.length; number++) xref.push(`${String(offsets[number]).padStart(10, "0")} 00000 n `);
  chunks.push(ascii(`${xref.join("\n")}\ntrailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
  return new Blob(chunks, { type: "application/pdf" });
}

export function createReceiptPdf(snapshot: ReceiptSnapshot, receiptNo: string, revision: number): Blob {
  const canvases: HTMLCanvasElement[] = [];
  let page = makePage(snapshot, receiptNo, revision, false);
  canvases.push(page.canvas);
  let y = page.y;

  for (const item of snapshot.items) {
    const label = `${item.name}${item.variant ? ` (${item.variant})` : ""}`;
    page.ctx.font = `500 12px ${FONT}`;
    const lines = wrap(page.ctx, label, 390);
    const rowHeight = Math.max(44, lines.length * 18 + 20);
    if (y + rowHeight > 895) {
      page = makePage(snapshot, receiptNo, revision, true);
      canvases.push(page.canvas);
      y = page.y;
    }
    page.ctx.fillStyle = "#172337";
    page.ctx.font = `500 12px ${FONT}`;
    lines.forEach((line, index) => page.ctx.fillText(line, LEFT + 12, y + 21 + index * 18));
    page.ctx.fillStyle = "#526176";
    page.ctx.font = `500 11px ${FONT}`;
    page.ctx.fillText(String(item.quantity), 480, y + 21);
    page.ctx.fillText(formatNaira(item.unit_price_kobo), 540, y + 21);
    page.ctx.fillStyle = "#172337";
    page.ctx.font = `700 11px ${FONT}`;
    page.ctx.textAlign = "right";
    page.ctx.fillText(formatNaira(item.line_total_kobo), RIGHT - 12, y + 21);
    page.ctx.textAlign = "left";
    rule(page.ctx, y + rowHeight);
    y += rowHeight;
  }

  if (y + 230 > 980) {
    page = makePage(snapshot, receiptNo, revision, true);
    canvases.push(page.canvas);
    y = page.y;
  }
  y += 22;
  const totalRows = [
    ["Total", formatNaira(snapshot.totals.total_kobo), true],
    ["Amount paid", formatNaira(snapshot.totals.paid_kobo), false],
    ["Outstanding balance", formatNaira(snapshot.totals.outstanding_kobo), true],
  ] as const;
  for (const [label, amount, strong] of totalRows) {
    page.ctx.fillStyle = strong ? "#172337" : "#718095";
    page.ctx.font = `${strong ? "700" : "500"} 13px ${FONT}`;
    page.ctx.fillText(label, 435, y);
    page.ctx.textAlign = "right";
    page.ctx.fillText(amount, RIGHT - 12, y);
    page.ctx.textAlign = "left";
    y += 25;
  }
  y += 16;
  rule(page.ctx, y);
  y += 28;
  text(page.ctx, `PAYMENTS · ${snapshot.totals.payment_status.toUpperCase()}`, LEFT, y, 350, "#718095", `800 10px ${FONT}`);
  y += 22;
  if (snapshot.payments.length === 0) {
    text(page.ctx, "No payment received yet.", LEFT, y, 500, "#526176", `400 11px ${FONT}`);
  } else {
    for (const payment of snapshot.payments) {
      if (y > 1014) {
        page = makePage(snapshot, receiptNo, revision, true);
        canvases.push(page.canvas);
        y = page.y;
      }
      const date = new Date(payment.recorded_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      text(page.ctx, `${date} · ${methodLabel(payment.method)} · ${formatNaira(payment.amount_kobo)}`, LEFT, y, RIGHT - LEFT, "#526176", `400 11px ${FONT}`);
      y += 21;
    }
  }
  page.ctx.fillStyle = "#826bbd";
  page.ctx.font = `600 11px ${FONT}`;
  page.ctx.textAlign = "center";
  page.ctx.fillText("Thank you for your purchase.", PAGE_WIDTH / 2, PAGE_HEIGHT - 42);
  page.ctx.textAlign = "left";
  return pdfFromPages(canvases);
}
