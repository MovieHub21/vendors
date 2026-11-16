import { layoutReport, PAGE_H, PAGE_W, type Block, type Op } from "./reportLayout";
import { pdfFromJpegPages, type JpegPage } from "./pdfFile";

const JPEG_QUALITY = 0.82; // sharp enough for text, small enough for long reports on a phone

function draw(ctx: CanvasRenderingContext2D, ops: Op[]) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  ctx.textBaseline = "alphabetic";
  for (const op of ops) {
    if (op.k === "rect") {
      if (op.fill) {
        ctx.fillStyle = op.fill;
        ctx.fillRect(op.x, op.y, op.w, op.h);
      }
      if (op.stroke) {
        ctx.strokeStyle = op.stroke;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(op.x, op.y, op.w, op.h);
      }
    } else {
      ctx.font = op.font;
      ctx.fillStyle = op.color;
      ctx.textAlign = op.align ?? "left";
      ctx.fillText(op.text, op.x, op.y);
    }
  }
}

const toJpeg = (canvas: HTMLCanvasElement) =>
  new Promise<Uint8Array>((resolve, reject) =>
    canvas.toBlob(
      async (blob) =>
        blob ? resolve(new Uint8Array(await blob.arrayBuffer())) : reject(new Error("Could not encode the page")),
      "image/jpeg",
      JPEG_QUALITY,
    ),
  );

const nextFrame = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0));

/**
 * Builds the PDF file in the browser. Pages are drawn one at a time on a single reused canvas and encoded straight away,
 * so even a store with hundreds of orders stays within a phone's memory. No print dialog is involved.
 */
export async function renderReportPdf(
  blocks: Block[],
  options: { footerText: string; onProgress?: (page: number, pages: number) => void },
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't create PDF files.");

  const pages = layoutReport(
    blocks,
    (text, font) => {
      ctx.font = font;
      return ctx.measureText(text).width;
    },
    { footerText: options.footerText },
  );

  const encoded: JpegPage[] = [];
  for (let i = 0; i < pages.length; i++) {
    draw(ctx, pages[i].ops);
    encoded.push({ bytes: await toJpeg(canvas), width: PAGE_W, height: PAGE_H });
    options.onProgress?.(i + 1, pages.length);
    await nextFrame(); // keep the page responsive while a long report is being built
  }
  return pdfFromJpegPages(encoded);
}
