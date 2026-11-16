import { describe, expect, it } from "vitest";
import { pdfFromJpegPages } from "./pdfFile";

const jpeg = (n: number) => new Uint8Array([0xff, 0xd8, ...Array.from({ length: n }, (_, i) => i % 250), 0xff, 0xd9]);

async function text(blob: Blob) {
  return new TextDecoder("latin1").decode(await blob.arrayBuffer());
}

describe("pdfFromJpegPages", () => {
  it("writes a structurally valid PDF with one page per image", async () => {
    const blob = pdfFromJpegPages(
      Array.from({ length: 3 }, (_, i) => ({ bytes: jpeg(50 + i), width: 1240, height: 1754 })),
    );
    expect(blob.type).toBe("application/pdf");
    const pdf = await text(blob);
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain("/Count 3");
    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(3);
    expect(pdf).toContain("/Width 1240 /Height 1754");
  });

  it("has a correct cross-reference table: every object starts exactly where the table says", async () => {
    const pdf = await text(
      pdfFromJpegPages([
        { bytes: jpeg(300), width: 100, height: 100 },
        { bytes: jpeg(10), width: 100, height: 100 },
      ]),
    );
    const start = Number(/startxref\n(\d+)\n%%EOF/.exec(pdf)![1]);
    expect(pdf.slice(start, start + 4)).toBe("xref");
    const entries = [...pdf.slice(start).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries.length).toBeGreaterThan(5);
    entries.forEach((offset, i) => expect(pdf.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
  });

  it("stores the JPEG bytes unchanged", async () => {
    const bytes = jpeg(120);
    const buf = new Uint8Array(await pdfFromJpegPages([{ bytes, width: 10, height: 10 }]).arrayBuffer());
    const hay = Array.from(buf).join(",");
    expect(hay).toContain(Array.from(bytes).join(","));
  });
});
