/**
 * Draws a receipt or invoice onto canvases (one per A4 page) from the vendor's template, then wraps them in a PDF.
 * The geometry (row heights, column widths, line height, where blocks move when a table grows) comes from the shared
 * template engine, so this matches what DocumentView shows on screen.
 */
import { ITEM_HEADERS, itemRows, paymentsContent, textLines, totalRows, type DocData, type Line } from "./docContent";
import {
  effectiveStyle,
  FONTS,
  insetOf,
  LABEL_SCALE,
  LINE_HEIGHT,
  MUTED_OPACITY,
  PAGE_H,
  PAGE_W,
  pageStarts,
  payHeadHeight,
  payRowHeight,
  resolveLayout,
  STRONG_SCALE,
  TABLE_COLS,
  tableHeadHeight,
  tableRowHeight,
  totalRowHeight,
  type FullStyle,
  type ResolvedBlock,
  type Template,
} from "./docTemplate";
import { pdfFromPages } from "./pdfFile";

const SCALE = 2;
type Ctx = CanvasRenderingContext2D;
type Images = Map<string, HTMLImageElement | null>;

// ------------------------------------------------------------------ loading

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = window.setTimeout(() => resolve(null), 8000);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

async function ensureFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`500 14px ${FONTS.sans}`),
      document.fonts.load(`700 14px ${FONTS.sans}`),
      document.fonts.load(`800 14px ${FONTS.display}`),
    ]);
  } catch {
    /* fall back to whatever font the browser has */
  }
}

function imageUrls(template: Template, doc: DocData): string[] {
  const urls = new Set<string>();
  for (const b of template.blocks) {
    if (b.type === "image" && b.src) urls.add(b.src);
    if (b.type === "logo" && doc.snapshot.business.logo_url) urls.add(doc.snapshot.business.logo_url);
  }
  return [...urls];
}

// ------------------------------------------------------------------ drawing helpers

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function setFont(ctx: Ctx, s: FullStyle, size: number, weight: number) {
  ctx.font = `${s.italic ? "italic " : ""}${weight} ${size}px ${FONTS[s.font]}`;
}

/** Wraps to a width like the browser does: at spaces, and inside a word that is wider than the box. */
function wrapText(ctx: Ctx, text: string, width: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= width) {
        line = next;
        continue;
      }
      if (line) out.push(line);
      let chunk = "";
      for (const ch of word) {
        if (chunk && ctx.measureText(chunk + ch).width > width) {
          out.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      line = chunk;
    }
    out.push(line);
  }
  return out;
}

function ellipsize(ctx: Ctx, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > width) t = t.slice(0, -1);
  return `${t}…`;
}

function drawAt(ctx: Ctx, text: string, align: "left" | "center" | "right", x: number, w: number, midY: number) {
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, align === "left" ? x : align === "center" ? x + w / 2 : x + w, midY);
}

// ------------------------------------------------------------------ one block

function drawLines(ctx: Ctx, lines: Line[], s: FullStyle, blockAlpha: number, x: number, y: number, w: number, h: number, upper: boolean) {
  let cy = y;
  for (const line of lines) {
    const size = line.tone === "strong" ? s.fontSize * STRONG_SCALE : line.tone === "label" ? s.fontSize * LABEL_SCALE : s.fontSize;
    const weight = line.tone === "strong" ? 700 : line.tone === "label" ? 800 : s.fontWeight;
    setFont(ctx, s, size, weight);
    ctx.fillStyle = line.tone === "label" ? s.accent : s.color;
    ctx.globalAlpha = blockAlpha * (line.tone === "muted" ? MUTED_OPACITY : 1);
    const lh = size * LINE_HEIGHT;
    const text = upper || line.tone === "label" ? line.text.toUpperCase() : line.text;
    for (const piece of wrapText(ctx, text, w)) {
      if (cy >= y + h) return;
      drawAt(ctx, piece, s.align, x, w, cy + lh / 2);
      cy += lh;
    }
    if (line.tone === "label") cy += 4;
  }
}

function drawBlock(ctx: Ctx, rb: ResolvedBlock, doc: DocData, images: Images) {
  const b = rb.block;
  const s = effectiveStyle(b);
  const x = b.x;
  const y = rb.y;
  const w = b.w;
  const h = rb.h;
  const alpha = s.opacity / 100;
  const isLine = b.type === "line";

  ctx.save();
  ctx.globalAlpha = alpha;
  const fill = isLine ? s.color : s.bg;
  if (fill !== "transparent") {
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, w, h, s.radius);
    ctx.fill();
  }
  if (s.borderWidth > 0 && !isLine) {
    const bw = s.borderWidth;
    ctx.strokeStyle = s.borderColor;
    ctx.lineWidth = bw;
    roundRect(ctx, x + bw / 2, y + bw / 2, w - bw, h - bw, s.radius - bw / 2);
    ctx.stroke();
  }
  if (isLine || b.type === "box") {
    ctx.restore();
    return;
  }

  roundRect(ctx, x, y, w, h, s.radius);
  ctx.clip();
  const inset = insetOf(s);
  const ix = x + inset;
  const iy = y + inset;
  const iw = w - 2 * inset;
  const ih = h - 2 * inset;

  switch (b.type) {
    case "brand": {
      setFont(ctx, s, s.fontSize, s.fontWeight);
      const sell = ctx.measureText("Sell").width;
      const total = sell + ctx.measureText("Sharp").width;
      const startX = s.align === "left" ? ix : s.align === "center" ? ix + (iw - total) / 2 : ix + iw - total;
      const midY = iy + (s.fontSize * LINE_HEIGHT) / 2;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = s.color;
      ctx.fillText("Sell", startX, midY);
      ctx.fillStyle = s.accent;
      ctx.fillText("Sharp", startX + sell, midY);
      break;
    }
    case "logo":
    case "image": {
      const url = b.type === "logo" ? doc.snapshot.business.logo_url : b.src;
      const img = url ? images.get(url) : null;
      if (img && img.naturalWidth > 0) {
        const k = Math.min(iw / img.naturalWidth, ih / img.naturalHeight);
        const dw = img.naturalWidth * k;
        const dh = img.naturalHeight * k;
        ctx.drawImage(img, ix + (iw - dw) / 2, iy + (ih - dh) / 2, dw, dh);
      }
      break;
    }
    case "items": {
      const headH = tableHeadHeight(s.fontSize);
      const rowH = tableRowHeight(s.fontSize);
      const nameW = iw - TABLE_COLS.qty - TABLE_COLS.price - TABLE_COLS.amount;
      const qtyX = ix + nameW;
      const priceX = qtyX + TABLE_COLS.qty;
      const amountX = priceX + TABLE_COLS.price;
      if (s.headBg !== "transparent") {
        ctx.fillStyle = s.headBg;
        ctx.fillRect(ix, iy, iw, headH);
      }
      setFont(ctx, s, Math.round(s.fontSize * 0.85), 700);
      ctx.fillStyle = s.headColor;
      drawAt(ctx, ITEM_HEADERS.name.toUpperCase(), "left", ix + 10, nameW, iy + headH / 2);
      drawAt(ctx, ITEM_HEADERS.qty.toUpperCase(), "left", qtyX + 10, TABLE_COLS.qty, iy + headH / 2);
      drawAt(ctx, ITEM_HEADERS.price.toUpperCase(), "right", priceX - 10, TABLE_COLS.price, iy + headH / 2);
      drawAt(ctx, ITEM_HEADERS.amount.toUpperCase(), "right", amountX - 10, TABLE_COLS.amount, iy + headH / 2);

      const lh = s.fontSize * LINE_HEIGHT;
      itemRows(doc).forEach((row, i) => {
        const top = iy + headH + i * rowH;
        if (i % 2 === 0 && s.stripe !== "transparent") {
          ctx.fillStyle = s.stripe;
          ctx.fillRect(ix, top, iw, rowH);
        }
        ctx.fillStyle = s.lineColor;
        ctx.fillRect(ix, top + rowH - 1, iw, 1);
        ctx.fillStyle = s.color;
        setFont(ctx, s, s.fontSize, s.fontWeight);
        let lines = wrapText(ctx, row.name, nameW - 20);
        if (lines.length > 2) lines = [lines[0], ellipsize(ctx, lines.slice(1).join(" "), nameW - 20)];
        const startY = top + (rowH - 1 - lines.length * lh) / 2;
        lines.forEach((l, n) => drawAt(ctx, l, "left", ix + 10, nameW, startY + n * lh + lh / 2));
        const mid = top + (rowH - 1) / 2;
        drawAt(ctx, row.qty, "left", qtyX + 10, TABLE_COLS.qty, mid);
        drawAt(ctx, row.price, "right", priceX - 10, TABLE_COLS.price, mid);
        drawAt(ctx, row.amount, "right", amountX - 10, TABLE_COLS.amount, mid);
      });
      break;
    }
    case "totals": {
      const rowH = totalRowHeight(s.fontSize);
      totalRows(doc).forEach((row, i) => {
        setFont(ctx, s, s.fontSize, row.strong ? 700 : s.fontWeight);
        ctx.fillStyle = s.color;
        const mid = iy + i * rowH + rowH / 2;
        drawAt(ctx, row.label, "left", ix, iw, mid);
        drawAt(ctx, row.amount, "right", ix, iw, mid);
      });
      break;
    }
    case "payments": {
      const content = paymentsContent(b, doc);
      const headH = payHeadHeight(s.fontSize);
      const rowH = payRowHeight(s.fontSize);
      setFont(ctx, s, s.fontSize * LABEL_SCALE, 800);
      ctx.fillStyle = s.accent;
      drawAt(ctx, content.heading, "left", ix, iw, iy + headH / 2);
      setFont(ctx, s, s.fontSize, s.fontWeight);
      ctx.fillStyle = s.color;
      if (content.empty) {
        ctx.globalAlpha = alpha * MUTED_OPACITY;
        drawAt(ctx, content.empty, "left", ix, iw, iy + headH + rowH / 2);
      } else {
        content.rows.forEach((row, i) => {
          const mid = iy + headH + i * rowH + rowH / 2;
          drawAt(ctx, row.left, "left", ix, iw, mid);
          drawAt(ctx, row.right, "right", ix, iw, mid);
        });
      }
      break;
    }
    default:
      drawLines(ctx, textLines(b, doc), s, alpha, ix, iy, iw, ih, s.uppercase);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ pages and PDF

/** One canvas per A4 page. Each page is drawn on its own so long receipts never need one huge canvas. */
export async function renderDocumentPages(doc: DocData, template: Template): Promise<HTMLCanvasElement[]> {
  const counts = { items: doc.snapshot.items.length, payments: doc.snapshot.payments.length };
  const { blocks, height } = resolveLayout(template, counts);
  const starts = pageStarts(blocks, height);
  await ensureFonts();
  const images: Images = new Map();
  await Promise.all(imageUrls(template, doc).map(async (url) => images.set(url, await loadImage(url))));

  return starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : height;
    const visible = Math.min(end - start, PAGE_H);
    const canvas = document.createElement("canvas");
    canvas.width = PAGE_W * SCALE;
    canvas.height = PAGE_H * SCALE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("PDF drawing is unavailable in this browser.");
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    if (template.background !== "transparent") {
      ctx.fillStyle = template.background;
      ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, PAGE_W, visible);
    ctx.clip();
    ctx.translate(0, -start);
    for (const rb of blocks) {
      if (rb.y + rb.h < start || rb.y > start + visible) continue;
      drawBlock(ctx, rb, doc, images);
    }
    ctx.restore();
    return canvas;
  });
}

export async function createDocumentPdf(doc: DocData, template: Template): Promise<Blob> {
  return pdfFromPages(await renderDocumentPages(doc, template));
}
