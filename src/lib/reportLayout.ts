/**
 * Page layout for the business-data PDF. Pure: it only needs a function that measures text, and it returns
 * "draw this here" instructions per A4 page, so it is fully unit-tested without a browser.
 * Coordinates are pixels at 150 dpi (A4 = 1240 × 1754).
 */
export const PAGE_W = 1240;
export const PAGE_H = 1754;
const MARGIN = 100;
const TOP = 110;
const BOTTOM = PAGE_H - 140; // leaves room for the footer
export const CONTENT_W = PAGE_W - MARGIN * 2;
export const CONTENT_H = BOTTOM - TOP;

const SANS = "Arial, Helvetica, sans-serif";
export const font = (weight: 400 | 700, px: number) => `${weight} ${px}px ${SANS}`;
const F = {
  body: font(400, 21),
  bold: font(700, 21),
  small: font(400, 17),
  smallBold: font(700, 17),
  tiny: font(400, 16),
  h2: font(700, 35),
  h3: font(700, 25),
  h4: font(700, 19),
  title: font(700, 52),
  stat: font(700, 31),
};
const COLOR = { ink: "#172033", muted: "#687386", line: "#dce2eb", head: "#f2f5f9" };
const LH = { body: 30, small: 24, tiny: 22 };

export interface Column {
  label: string;
  /** relative width */
  weight: number;
  align?: "left" | "right";
}
export type Block =
  | { type: "title"; eyebrow: string; title: string; subtitle?: string; meta?: string }
  | { type: "stats"; items: Array<{ label: string; value: string }> }
  | { type: "h2"; text: string; pageBreak?: boolean }
  | { type: "h3"; left: string; right?: string }
  | { type: "h4"; text: string }
  | { type: "text"; text: string; muted?: boolean; small?: boolean }
  | { type: "facts"; items: Array<{ label: string; value: string }> }
  | { type: "table"; columns: Column[]; rows: string[][]; emptyText?: string }
  | { type: "group"; blocks: Block[] }
  | { type: "gap"; px?: number }
  | { type: "pageBreak" };

export type Op =
  | { k: "text"; x: number; y: number; text: string; font: string; color: string; align?: "left" | "right" }
  | { k: "rect"; x: number; y: number; w: number; h: number; fill?: string; stroke?: string };
export interface Page {
  ops: Op[];
}
export type Measure = (text: string, font: string) => number;

/** Wraps text to a width. Words wider than the whole line are broken so nothing ever runs off the page. */
export function wrapText(text: string, width: number, fontName: string, measure: Measure): string[] {
  const lines: string[] = [];
  for (const paragraph of String(text).split(/\r?\n/)) {
    let line = "";
    const push = () => {
      lines.push(line);
      line = "";
    };
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, fontName) <= width) {
        line = candidate;
        continue;
      }
      if (line) push();
      if (measure(word, fontName) <= width) {
        line = word;
        continue;
      }
      for (const ch of word) {
        if (line && measure(line + ch, fontName) > width) push();
        line += ch;
      }
    }
    lines.push(line);
    line = "";
  }
  return lines.length ? lines : [""];
}

export interface LayoutOptions {
  footerText: string;
}

export function layoutReport(blocks: Block[], measure: Measure, options: LayoutOptions): Page[] {
  const pages: Page[] = [{ ops: [] }];
  let y = TOP;
  const page = () => pages[pages.length - 1];
  const newPage = () => {
    pages.push({ ops: [] });
    y = TOP;
  };
  const remaining = () => BOTTOM - y;
  const ensure = (height: number) => {
    if (y + height > BOTTOM && y > TOP) newPage();
  };
  const wrap = (t: string, width: number, f: string) => wrapText(t, width, f, measure);

  /* ---- heights (as if on an endless page) ---- */
  const colWidths = (columns: Column[]) => {
    const total = columns.reduce((s, c) => s + c.weight, 0);
    return columns.map((c) => (CONTENT_W * c.weight) / total);
  };
  const PAD = 9;
  const rowHeight = (cells: string[], widths: number[], f: string, lh: number) =>
    Math.max(...cells.map((c, i) => wrap(c, widths[i] - PAD * 2, f).length)) * lh + PAD * 2;
  const tableHeader = (b: Extract<Block, { type: "table" }>) =>
    rowHeight(
      b.columns.map((c) => c.label),
      colWidths(b.columns),
      F.smallBold,
      LH.small,
    );

  function height(b: Block): number {
    switch (b.type) {
      case "title":
        return 0;
      case "stats":
        return Math.ceil(b.items.length / 3) * 130 + 20;
      case "h2":
        return 62 + 20;
      case "h3":
        return 40;
      case "h4":
        return 34;
      case "text":
        return wrap(b.text, CONTENT_W, b.small ? F.small : F.body).length * (b.small ? LH.small : LH.body) + 8;
      case "facts":
        return factRows(b).reduce((s, r) => s + r, 0) + 12;
      case "table": {
        const w = colWidths(b.columns);
        const body = b.rows.length
          ? b.rows.reduce((sum, r) => sum + rowHeight(r, w, F.small, LH.small), 0)
          : wrap(b.emptyText ?? "None recorded", CONTENT_W - PAD * 2, F.small).length * LH.small + PAD * 2;
        return tableHeader(b) + body + 18;
      }
      case "group":
        return b.blocks.reduce((s, c) => s + height(c), 0);
      case "gap":
        return b.px ?? 20;
      case "pageBreak":
        return 0;
    }
  }

  function factRows(b: Extract<Block, { type: "facts" }>): number[] {
    const colW = (CONTENT_W - 30) / 2;
    const rows: number[] = [];
    for (let i = 0; i < b.items.length; i += 2) {
      const pair = b.items.slice(i, i + 2);
      rows.push(Math.max(...pair.map((it) => 22 + wrap(it.value, colW, F.body).length * LH.body)) + 6);
    }
    return rows;
  }

  /* ---- drawing ---- */
  function drawText(
    x: number,
    baseline: number,
    text: string,
    f: string,
    color = COLOR.ink,
    align: "left" | "right" = "left",
  ) {
    page().ops.push({ k: "text", x, y: baseline, text, font: f, color, align });
  }
  function drawLines(x: number, top: number, lines: string[], f: string, lh: number, color = COLOR.ink) {
    lines.forEach((l, i) => drawText(x, top + (i + 1) * lh - 7, l, f, color));
  }

  function drawTableRow(cells: string[], widths: number[], columns: Column[], f: string, lh: number, header: boolean) {
    const h = rowHeight(cells, widths, f, lh);
    let x = MARGIN;
    cells.forEach((c, i) => {
      page().ops.push({ k: "rect", x, y, w: widths[i], h, fill: header ? COLOR.head : undefined, stroke: COLOR.line });
      const lines = wrap(c, widths[i] - PAD * 2, f);
      lines.forEach((l, li) => {
        const right = columns[i].align === "right";
        drawText(
          right ? x + widths[i] - PAD : x + PAD,
          y + PAD + (li + 1) * lh - 6,
          l,
          f,
          COLOR.ink,
          right ? "right" : "left",
        );
      });
      x += widths[i];
    });
    y += h;
  }

  function add(b: Block) {
    switch (b.type) {
      case "title": {
        y = TOP + 120;
        drawText(MARGIN, y, b.eyebrow, F.small, COLOR.muted);
        y += 20;
        const lines = wrap(b.title, CONTENT_W, F.title);
        lines.forEach((l) => {
          y += 62;
          drawText(MARGIN, y, l, F.title);
        });
        if (b.subtitle) {
          y += 40;
          drawText(MARGIN, y, b.subtitle, F.body, COLOR.ink);
        }
        if (b.meta) {
          for (const l of wrap(b.meta, CONTENT_W, F.small)) {
            y += 34;
            drawText(MARGIN, y, l, F.small, COLOR.muted);
          }
        }
        y += 40;
        return;
      }
      case "stats": {
        const colW = (CONTENT_W - 40) / 3;
        b.items.forEach((it, i) => {
          const x = MARGIN + (i % 3) * (colW + 20);
          const top = y + Math.floor(i / 3) * 130;
          page().ops.push({ k: "rect", x, y: top, w: colW, h: 110, stroke: COLOR.line });
          drawText(x + 20, top + 38, it.label, F.small, COLOR.muted);
          const v = wrap(it.value, colW - 40, F.stat)[0];
          drawText(x + 20, top + 86, v, F.stat);
        });
        y += Math.ceil(b.items.length / 3) * 130 + 20;
        return;
      }
      case "h2": {
        if (b.pageBreak && y > TOP) newPage();
        ensure(height(b) + 160);
        drawText(MARGIN, y + 36, b.text, F.h2);
        page().ops.push({ k: "rect", x: MARGIN, y: y + 56, w: CONTENT_W, h: 1.5, fill: COLOR.line });
        y += height(b);
        return;
      }
      case "h3": {
        ensure(height(b) + 140);
        drawText(MARGIN, y + 26, b.left, F.h3);
        if (b.right) drawText(PAGE_W - MARGIN, y + 26, b.right, F.small, COLOR.muted, "right");
        y += height(b);
        return;
      }
      case "h4": {
        ensure(height(b) + 110);
        drawText(MARGIN, y + 22, b.text, F.h4, COLOR.muted);
        y += height(b);
        return;
      }
      case "text": {
        const f = b.small ? F.small : F.body,
          lh = b.small ? LH.small : LH.body;
        const lines = wrap(b.text, CONTENT_W, f);
        let i = 0;
        while (i < lines.length) {
          const fit = Math.max(1, Math.floor(remaining() / lh));
          const chunk = lines.slice(i, i + fit);
          drawLines(MARGIN, y, chunk, f, lh, b.muted ? COLOR.muted : COLOR.ink);
          y += chunk.length * lh;
          i += chunk.length;
          if (i < lines.length) newPage();
        }
        y += 8;
        return;
      }
      case "facts": {
        const colW = (CONTENT_W - 30) / 2;
        const rowHs = factRows(b);
        for (let r = 0; r < rowHs.length; r++) {
          ensure(rowHs[r]);
          for (const [j, it] of b.items.slice(r * 2, r * 2 + 2).entries()) {
            const x = MARGIN + j * (colW + 30);
            drawText(x, y + 17, it.label, F.tiny, COLOR.muted);
            drawLines(x, y + 22, wrap(it.value, colW, F.body), F.body, LH.body);
          }
          y += rowHs[r];
        }
        y += 12;
        return;
      }
      case "table": {
        const widths = colWidths(b.columns);
        const header = () =>
          drawTableRow(
            b.columns.map((c) => c.label),
            widths,
            b.columns,
            F.smallBold,
            LH.small,
            true,
          );
        ensure(tableHeader(b) + (b.rows.length ? rowHeight(b.rows[0], widths, F.small, LH.small) : 60));
        header();
        if (!b.rows.length) {
          const h = wrap(b.emptyText ?? "None recorded", CONTENT_W - PAD * 2, F.small).length * LH.small + PAD * 2;
          page().ops.push({ k: "rect", x: MARGIN, y, w: CONTENT_W, h, stroke: COLOR.line });
          drawLines(
            MARGIN + PAD,
            y + PAD,
            wrap(b.emptyText ?? "None recorded", CONTENT_W - PAD * 2, F.small),
            F.small,
            LH.small,
            COLOR.muted,
          );
          y += h;
        }
        for (const row of b.rows) {
          const h = rowHeight(row, widths, F.small, LH.small);
          if (y + h > BOTTOM && y > TOP) {
            newPage();
            header();
          } // the header repeats on every page
          drawTableRow(row, widths, b.columns, F.small, LH.small, false);
        }
        y += 18;
        return;
      }
      case "group": {
        const h = height(b);
        if (h <= CONTENT_H) ensure(h); // keep one order / customer card together on a page when it fits
        b.blocks.forEach(add);
        return;
      }
      case "gap":
        y += b.px ?? 20;
        return;
      case "pageBreak":
        if (y > TOP) newPage();
        return;
    }
  }

  blocks.forEach(add);

  const total = pages.length;
  pages.forEach((p, i) => {
    p.ops.push({
      k: "text",
      x: MARGIN,
      y: PAGE_H - 70,
      text: options.footerText,
      font: F.tiny,
      color: COLOR.muted,
      align: "left",
    });
    p.ops.push({
      k: "text",
      x: PAGE_W - MARGIN,
      y: PAGE_H - 70,
      text: `Page ${i + 1} of ${total}`,
      font: F.tiny,
      color: COLOR.muted,
      align: "right",
    });
  });
  return pages;
}
