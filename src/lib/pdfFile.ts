/** Turns page canvases into a PDF file (one JPEG per A4 page). No libraries: the PDF structure is written by hand. */

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

export function pdfFromPages(pages: HTMLCanvasElement[]): Blob {
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
  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}
