/**
 * Receipt / invoice templates: the model, the validator, the CSS generator and the page-layout maths.
 *
 * Pure TypeScript (no Deno, no DOM, no imports) so the SAME code runs in three places:
 *   - the edge function, which validates what the browser sends and generates the CSS that gets stored,
 *   - the browser designer (live preview) and the receipt / invoice pages,
 *   - the Node unit tests.
 *
 * A vendor never writes CSS. They drag blocks around a page; the designer produces a `Template` (JSON), and
 * `templateToCss` turns the placement and colours into CSS. The server regenerates that CSS itself from the
 * validated JSON, so the stored CSS can only ever contain the declarations produced below.
 */

export const PAGE_W = 794;
export const PAGE_H = 1123;
export const MAX_BLOCKS = 40;

export const DOC_KINDS = ["receipt", "invoice"] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const BLOCK_TYPES = [
  "brand", // SellSharp wordmark
  "logo", // the store's own logo
  "store", // store name + city and state
  "title", // RECEIPT / INVOICE label, number, status
  "order", // order reference, channel, date
  "customer", // billed to
  "items", // the item table (grows with the order)
  "totals", // total / paid / balance
  "payments", // payment history (grows with the order)
  "bank", // account number and other payment details
  "text", // free text (supports {{tags}})
  "image", // picture from a link
  "line", // divider
  "box", // coloured rectangle
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const FONTS = {
  sans: "'DM Sans Variable', 'DM Sans', Arial, sans-serif",
  display: "'Manrope Variable', Manrope, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', Courier, monospace",
} as const;
export type FontKey = keyof typeof FONTS;
export const FONT_KEYS = Object.keys(FONTS) as FontKey[];

export const FONT_WEIGHTS = [400, 500, 600, 700, 800] as const;
export const ALIGNS = ["left", "center", "right"] as const;

export interface BlockStyle {
  color?: string;
  accent?: string;
  bg?: string;
  borderColor?: string;
  borderWidth?: number;
  radius?: number;
  fontSize?: number;
  fontWeight?: number;
  italic?: boolean;
  align?: (typeof ALIGNS)[number];
  font?: FontKey;
  padding?: number;
  opacity?: number;
  uppercase?: boolean;
  letterSpacing?: number;
  headBg?: string;
  headColor?: string;
  stripe?: string;
  lineColor?: string;
}
export type FullStyle = Required<BlockStyle>;

export interface Block {
  id: string;
  type: BlockType;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Free text for `text` blocks; a short heading override for title / order / customer / bank / payments. */
  text?: string;
  /** https link for `image` blocks. */
  src?: string;
  style: BlockStyle;
}

export interface Template {
  version: 1;
  background: string;
  blocks: Block[];
}

export class TemplateError extends Error {}

// ------------------------------------------------------------------ defaults

const BASE_STYLE: FullStyle = {
  color: "#172337",
  accent: "#826bbd",
  bg: "transparent",
  borderColor: "#e8ebf1",
  borderWidth: 0,
  radius: 0,
  fontSize: 13,
  fontWeight: 500,
  italic: false,
  align: "left",
  font: "sans",
  padding: 0,
  opacity: 100,
  uppercase: false,
  letterSpacing: 0,
  headBg: "#172b43",
  headColor: "#ffffff",
  stripe: "transparent",
  lineColor: "#e8ebf1",
};

interface Preset {
  w: number;
  h: number;
  text?: string;
  src?: string;
  style: BlockStyle;
}
const CARD: BlockStyle = { bg: "#f7f8fb", padding: 14, radius: 8, fontSize: 12 };

export const BLOCK_PRESETS: Record<BlockType, Preset> = {
  brand: { w: 220, h: 44, style: { fontSize: 28, fontWeight: 800, font: "display", color: "#172b43", accent: "#826bbd" } },
  logo: { w: 64, h: 64, style: { radius: 8 } },
  store: { w: 400, h: 70, style: { fontSize: 12 } },
  title: { w: 246, h: 84, style: { bg: "#f4f2fb", padding: 14, radius: 10, fontSize: 12 } },
  order: { w: 340, h: 108, style: { ...CARD } },
  customer: { w: 340, h: 108, style: { ...CARD } },
  items: { w: 698, h: 139, style: { fontSize: 12 } },
  totals: { w: 300, h: 84, style: { fontSize: 13 } },
  payments: { w: 360, h: 120, style: { fontSize: 12 } },
  bank: { w: 340, h: 132, style: { ...CARD } },
  text: { w: 300, h: 40, text: "Your text here", style: { fontSize: 13 } },
  image: { w: 120, h: 80, src: "", style: {} },
  line: { w: 698, h: 2, style: { color: "#e8ebf1" } },
  box: { w: 200, h: 100, style: { bg: "#f7f8fb", radius: 8 } },
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  brand: "SellSharp name",
  logo: "Store logo",
  store: "Store name & location",
  title: "Receipt / invoice title",
  order: "Order details",
  customer: "Customer",
  items: "Items table",
  totals: "Totals",
  payments: "Payment history",
  bank: "Bank / payment details",
  text: "Text",
  image: "Image",
  line: "Line",
  box: "Box",
};

/** Style with every property filled in: the block's own values over its type's preset over the base. */
export function effectiveStyle(b: Pick<Block, "type" | "style">): FullStyle {
  return { ...BASE_STYLE, ...BLOCK_PRESETS[b.type].style, ...b.style };
}

export function newBlock(type: BlockType, id: string, x = 48, y = 48): Block {
  const p = BLOCK_PRESETS[type];
  const w = Math.min(p.w, PAGE_W - x);
  const block: Block = { id, type, x, y: Math.min(y, PAGE_H - p.h), w, h: p.h, style: { ...p.style } };
  if (p.text !== undefined) block.text = p.text;
  if (p.src !== undefined) block.src = p.src;
  return block;
}

// ------------------------------------------------------------------ validation

const ID = /^[a-z0-9]{1,12}$/;
const COLOR = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|transparent)$/i;
const HTTPS_URL = /^https:\/\/[^\s"'`()<>\\{}]{1,480}$/;
const LABEL_TYPES: readonly BlockType[] = ["title", "order", "customer", "bank", "payments"];

function fail(message: string): never {
  throw new TemplateError(message);
}
function int(v: unknown, min: number, max: number, field: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(`${field} must be a number.`);
  return Math.round(Math.min(max, Math.max(min, v)));
}
function color(v: unknown, field: string): string {
  if (typeof v !== "string" || !COLOR.test(v)) fail(`${field} must be a colour like #1a2b3c.`);
  return v.toLowerCase();
}
function cleanText(v: unknown, max: number, field: string): string {
  if (typeof v !== "string") fail(`${field} must be text.`);
  // eslint-disable-next-line no-control-regex
  return v.replace(/\r/g, "").replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").slice(0, max);
}

function parseStyle(raw: unknown): BlockStyle {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) fail("A block's style must be an object.");
  const r = raw as Record<string, unknown>;
  const s: BlockStyle = {};
  const has = (k: string) => r[k] !== undefined && r[k] !== null;
  for (const k of ["color", "accent", "bg", "borderColor", "headBg", "headColor", "stripe", "lineColor"] as const) {
    if (has(k)) s[k] = color(r[k], k);
  }
  if (has("borderWidth")) s.borderWidth = int(r.borderWidth, 0, 12, "borderWidth");
  if (has("radius")) s.radius = int(r.radius, 0, 200, "radius");
  if (has("fontSize")) s.fontSize = int(r.fontSize, 8, 72, "fontSize");
  if (has("padding")) s.padding = int(r.padding, 0, 60, "padding");
  if (has("opacity")) s.opacity = int(r.opacity, 5, 100, "opacity");
  if (has("letterSpacing")) s.letterSpacing = int(r.letterSpacing, 0, 10, "letterSpacing");
  if (has("fontWeight")) {
    const w = int(r.fontWeight, 400, 800, "fontWeight");
    s.fontWeight = FONT_WEIGHTS.reduce((best, c) => (Math.abs(c - w) < Math.abs(best - w) ? c : best), 400 as number);
  }
  if (has("italic")) s.italic = r.italic === true;
  if (has("uppercase")) s.uppercase = r.uppercase === true;
  if (has("align")) {
    if (!ALIGNS.includes(r.align as (typeof ALIGNS)[number])) fail("align must be left, center or right.");
    s.align = r.align as (typeof ALIGNS)[number];
  }
  if (has("font")) {
    if (!FONT_KEYS.includes(r.font as FontKey)) fail("That font isn't available.");
    s.font = r.font as FontKey;
  }
  return s;
}

/** Validates (and tidies) a template from an untrusted source. Throws TemplateError with a vendor-readable message. */
export function validateTemplate(input: unknown): Template {
  if (typeof input !== "object" || input === null || Array.isArray(input)) fail("The design is not valid.");
  const raw = input as Record<string, unknown>;
  if (!Array.isArray(raw.blocks)) fail("The design has no blocks.");
  if (raw.blocks.length === 0) fail("Add at least one block to your design.");
  if (raw.blocks.length > MAX_BLOCKS) fail(`A design can have at most ${MAX_BLOCKS} blocks.`);

  const seen = new Set<string>();
  const blocks: Block[] = raw.blocks.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) fail(`Block ${index + 1} is not valid.`);
    const b = item as Record<string, unknown>;
    if (typeof b.id !== "string" || !ID.test(b.id)) fail(`Block ${index + 1} has an invalid id.`);
    if (seen.has(b.id)) fail("Two blocks share the same id.");
    seen.add(b.id);
    if (typeof b.type !== "string" || !BLOCK_TYPES.includes(b.type as BlockType)) fail(`Block ${index + 1} has an unknown type.`);
    const type = b.type as BlockType;

    const x = int(b.x, 0, PAGE_W - 8, "x");
    const y = int(b.y, 0, PAGE_H - 1, "y");
    const block: Block = {
      id: b.id,
      type,
      x,
      y,
      w: int(b.w, 8, PAGE_W - x, "width"),
      h: int(b.h, 1, PAGE_H - y, "height"),
      style: parseStyle(b.style),
    };
    if (type === "text") block.text = cleanText(b.text ?? "", 600, "text");
    else if (LABEL_TYPES.includes(type) && b.text !== undefined && b.text !== null) block.text = cleanText(b.text, 40, "heading");
    if (type === "image") {
      const src = typeof b.src === "string" ? b.src.trim() : "";
      if (src && !HTTPS_URL.test(src)) fail("Image links must start with https:// and contain no spaces.");
      block.src = src;
    }
    return block;
  });

  return { version: 1, background: raw.background === undefined ? "#ffffff" : color(raw.background, "background"), blocks };
}

// ------------------------------------------------------------------ geometry shared by the screen and PDF renderers

export const TABLE_COLS = { qty: 56, price: 108, amount: 118 } as const;
export const LINE_HEIGHT = 1.45;
export const STRONG_SCALE = 1.2;
export const LABEL_SCALE = 0.8;
export const MUTED_OPACITY = 0.72;
export const TOTAL_ROWS = 3;

/** Space between a block's edge and its content: padding plus border (both draw inside the box). */
export const insetOf = (s: Pick<FullStyle, "padding" | "borderWidth">) => s.padding + s.borderWidth;

export const tableHeadHeight = (fontSize: number) => Math.max(30, Math.round(fontSize * 2.6));
export const tableRowHeight = (fontSize: number) => Math.max(34, Math.round(fontSize * 3));
export const payHeadHeight = (fontSize: number) => Math.round(fontSize * 2.2);
export const payRowHeight = (fontSize: number) => Math.round(fontSize * 1.9);
export const totalRowHeight = (fontSize: number) => Math.round(fontSize * 2);

export interface Counts {
  items: number;
  payments: number;
}
export interface ResolvedBlock {
  block: Block;
  y: number;
  h: number;
}

/** How many pixels taller than designed this block must be for the given order (0 for fixed-size blocks). */
export function growthOf(b: Block, counts: Counts): number {
  const s = effectiveStyle(b);
  if (b.type === "items") {
    return Math.max(0, 2 * insetOf(s) + tableHeadHeight(s.fontSize) + counts.items * tableRowHeight(s.fontSize) - b.h);
  }
  if (b.type === "payments") {
    const rows = Math.max(1, counts.payments);
    return Math.max(0, 2 * insetOf(s) + payHeadHeight(s.fontSize) + rows * payRowHeight(s.fontSize) - b.h);
  }
  return 0;
}

/**
 * Real positions for one order. The items table and payment list grow with the order; everything designed below a
 * growing block moves down by the same amount, and a box that wraps a growing block gets taller, so a long order
 * never overlaps the totals underneath.
 */
export function resolveLayout(t: Template, counts: Counts): { blocks: ResolvedBlock[]; height: number } {
  const growers = t.blocks
    .map((block) => ({ block, extra: growthOf(block, counts) }))
    .filter((g) => g.extra > 0)
    .sort((a, b) => a.block.y - b.block.y);

  const blocks = t.blocks.map((block) => {
    let shift = 0;
    let grow = 0;
    for (const g of growers) {
      if (g.block === block) grow += g.extra;
      else if (block.y >= g.block.y + g.block.h) shift += g.extra;
      else if (block.type === "box" && block.y <= g.block.y && block.y + block.h >= g.block.y + g.block.h) grow += g.extra;
    }
    return { block, y: block.y + shift, h: block.h + grow };
  });

  const bottom = blocks.reduce((m, r) => Math.max(m, r.y + r.h), 0);
  return { blocks, height: bottom > PAGE_H ? Math.ceil(bottom + 40) : PAGE_H };
}

/**
 * Where each PDF page starts. Pages are normally PAGE_H tall; if a page would end in the middle of a table row, the
 * break moves up to the row boundary so no row is cut in half.
 */
export function pageStarts(resolved: ResolvedBlock[], height: number): number[] {
  const starts = [0];
  let start = 0;
  while (start + PAGE_H < height - 0.5 && starts.length < 12) {
    let cut = start + PAGE_H;
    for (const r of resolved) {
      if (r.block.type !== "items" && r.block.type !== "payments") continue;
      const s = effectiveStyle(r.block);
      const head = r.block.type === "items" ? tableHeadHeight(s.fontSize) : payHeadHeight(s.fontSize);
      const row = r.block.type === "items" ? tableRowHeight(s.fontSize) : payRowHeight(s.fontSize);
      const bodyTop = r.y + insetOf(s) + head;
      if (cut > bodyTop && cut < r.y + r.h) {
        const rowTop = bodyTop + Math.floor((cut - bodyTop) / row) * row;
        if (rowTop > start + 40) cut = rowTop;
      }
    }
    starts.push(cut);
    start = cut;
  }
  return starts;
}

// ------------------------------------------------------------------ CSS generation

/** Rules every template shares (the generated CSS is stored in full so it never depends on app stylesheets). */
function commonRules(scope: string, background: string): string[] {
  return [
    `${scope}{position:relative;width:${PAGE_W}px;min-height:${PAGE_H}px;background:${background};overflow:hidden;box-sizing:border-box;line-height:${LINE_HEIGHT}}`,
    `${scope} .b{position:absolute;box-sizing:border-box;overflow:hidden;overflow-wrap:anywhere}`,
    `${scope} .b img{display:block;width:100%;height:100%;object-fit:contain}`,
    `${scope} .ln{margin:0}`,
    `${scope} .ln-strong{font-weight:700;font-size:${STRONG_SCALE}em}`,
    `${scope} .ln-muted{opacity:${MUTED_OPACITY}}`,
    `${scope} .ln-label{font-weight:800;font-size:${LABEL_SCALE}em;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}`,
    `${scope} .c{min-width:0;padding:0 10px}`,
    `${scope} .c.r{text-align:right}`,
    `${scope} .nm{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}`,
    `${scope} .kv{display:flex;justify-content:space-between;gap:12px}`,
    `${scope} .lbl{font-weight:800;font-size:${LABEL_SCALE}em;text-transform:uppercase;letter-spacing:.06em}`,
    `${scope} .th,${scope} .tr,${scope} .pay,${scope} .ph,${scope} .kv{box-sizing:border-box}`,
  ];
}

function blockRules(b: Block, scope: string): string[] {
  const s = effectiveStyle(b);
  const sel = `${scope} .b-${b.id}`;
  const decl = [
    `left:${b.x}px`,
    `top:${b.y}px`,
    `width:${b.w}px`,
    `height:${b.h}px`,
    `background:${b.type === "line" ? s.color : s.bg}`,
    `color:${s.color}`,
    `font-family:${FONTS[s.font]}`,
    `font-size:${s.fontSize}px`,
    `font-weight:${s.fontWeight}`,
    `font-style:${s.italic ? "italic" : "normal"}`,
    `text-align:${s.align}`,
    `padding:${b.type === "line" ? 0 : s.padding}px`,
    `border-radius:${s.radius}px`,
    `opacity:${s.opacity / 100}`,
  ];
  if (s.borderWidth > 0 && b.type !== "line") decl.push(`border:${s.borderWidth}px solid ${s.borderColor}`);
  if (s.uppercase) decl.push("text-transform:uppercase");
  if (s.letterSpacing > 0) decl.push(`letter-spacing:${s.letterSpacing}px`);
  const rules = [`${sel}{${decl.join(";")}}`];

  if (b.type === "title" || b.type === "order" || b.type === "customer" || b.type === "bank") {
    rules.push(`${sel} .ln-label{color:${s.accent}}`);
  }
  if (b.type === "payments") rules.push(`${sel} .lbl{color:${s.accent}}`);
  if (b.type === "brand") rules.push(`${sel} .accent{color:${s.accent}}`);
  if (b.type === "items") {
    const cols = `1fr ${TABLE_COLS.qty}px ${TABLE_COLS.price}px ${TABLE_COLS.amount}px`;
    rules.push(
      `${sel} .th{display:grid;grid-template-columns:${cols};align-items:center;height:${tableHeadHeight(s.fontSize)}px;background:${s.headBg};color:${s.headColor};font-size:${Math.round(s.fontSize * 0.85)}px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}`,
      `${sel} .tr{display:grid;grid-template-columns:${cols};align-items:center;height:${tableRowHeight(s.fontSize)}px;border-bottom:1px solid ${s.lineColor}}`,
      `${sel} .tr:nth-child(even){background:${s.stripe}}`,
    );
  }
  if (b.type === "payments") {
    rules.push(`${sel} .pay{display:flex;justify-content:space-between;align-items:center;height:${payRowHeight(s.fontSize)}px}`);
    rules.push(`${sel} .ph{display:flex;align-items:center;height:${payHeadHeight(s.fontSize)}px}`);
  }
  if (b.type === "totals") rules.push(`${sel} .kv{align-items:center;height:${totalRowHeight(s.fontSize)}px}`, `${sel} .kv.strong{font-weight:700}`);
  return rules;
}

/** Placement, colours and type as CSS. Contains no url(), no @-rules, no quotes other than font names. */
export function templateToCss(t: Template, scope = ".doc-tpl"): string {
  return [...commonRules(scope, t.background), ...t.blocks.flatMap((b) => blockRules(b, scope))].join("\n");
}

// ------------------------------------------------------------------ starting designs

const NAVY = "#172b43";
const MUTED_LINE = "#e8ebf1";

export function defaultTemplate(kind: DocKind): Template {
  const b = (type: BlockType, id: string, x: number, y: number, w: number, h: number, extra: Partial<Block> = {}): Block => ({
    id,
    type,
    x,
    y,
    w,
    h,
    style: { ...BLOCK_PRESETS[type].style, ...(extra.style ?? {}) },
    ...(extra.text !== undefined ? { text: extra.text } : {}),
  });

  const common: Block[] = [
    b("box", "topbar", 0, 0, PAGE_W, 10, { style: { bg: NAVY, radius: 0 } }),
    b("brand", "brand", 48, 38, 260, 44),
    b("title", "title", 500, 32, 246, 92),
    b("store", "store", 48, 96, 420, 70, { style: { fontSize: 12 } }),
    b("line", "rule", 48, 178, 698, 1, { style: { color: MUTED_LINE } }),
    b("customer", "customer", 48, 198, 340, 108),
    b("order", "order", 406, 198, 340, 108),
    b("items", "items", 48, 330, 698, 139),
  ];

  if (kind === "invoice") {
    return {
      version: 1,
      background: "#ffffff",
      blocks: [
        ...common,
        b("bank", "bank", 48, 492, 340, 132),
        b("totals", "totals", 446, 492, 300, 84),
        b("text", "footer", 48, 650, 698, 44, {
          text: "Please pay {{balance}} to the account above and send your proof of payment. Thank you for your business.",
          style: { fontSize: 12, align: "center", color: "#718095" },
        }),
      ],
    };
  }
  return {
    version: 1,
    background: "#ffffff",
    blocks: [
      ...common,
      b("payments", "payments", 48, 492, 360, 120),
      b("totals", "totals", 446, 492, 300, 84),
      b("text", "footer", 48, 640, 698, 30, {
        text: "Thank you for your purchase.",
        style: { fontSize: 12, align: "center", color: "#826bbd", fontWeight: 600 },
      }),
    ],
  };
}
