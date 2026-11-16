import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BusinessExport from "./BusinessExport";

const download = vi.hoisted(() => vi.fn());
const renderPdf = vi.hoisted(() => vi.fn());

vi.mock("../lib/download", () => ({ downloadBlob: download }));
vi.mock("../lib/reportPdf", () => ({ renderReportPdf: renderPdf }));
vi.mock("../hooks/useVendor", () => ({
  useVendor: () => ({ me: { store: { id: "s1", slug: "ama-hairs", name: "Ama Hair Studio" } } }),
}));
vi.mock("../components/DashboardShell", () => ({
  DashboardShell: ({ children }: { children: () => unknown }) => <div>{children() as never}</div>,
}));
vi.mock("../lib/supabase", () => {
  const query = () => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "in"]) q[m] = () => q;
    q.range = async () => ({ data: [], error: null });
    return q;
  };
  return { supabase: { from: () => query() } };
});

describe("business data export", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    renderPdf.mockImplementation(async (_blocks: unknown, opts: { onProgress?: (p: number, t: number) => void }) => {
      opts.onProgress?.(1, 4);
      return new Blob(["%PDF-1.4 sample"], { type: "application/pdf" });
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("downloads a PDF file directly and never opens a print window", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<BusinessExport />);
    fireEvent.click(screen.getByRole("button", { name: /Download business data PDF/ }));

    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    const [blob, filename] = download.mock.calls[0] as [Blob, string];
    expect(blob.type).toBe("application/pdf");
    expect(filename).toMatch(/^ama-hairs-business-data-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(open).not.toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
  });

  it("tells the vendor it worked and offers a big 'Download PDF again' button (phones can block automatic downloads)", async () => {
    render(<BusinessExport />);
    fireEvent.click(screen.getByRole("button", { name: /Download business data PDF/ }));
    expect(await screen.findByText(/Your PDF is ready: 4 pages/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Download PDF again/ }));
    expect(download).toHaveBeenCalledTimes(2);
  });

  it("uses the large mobile button style for both buttons", async () => {
    render(<BusinessExport />);
    expect(screen.getByRole("button", { name: /Download business data PDF/ })).toHaveClass("export-pdf-btn");
    fireEvent.click(screen.getByRole("button", { name: /Download business data PDF/ }));
    expect(await screen.findByRole("button", { name: /Download PDF again/ })).toHaveClass("export-pdf-btn");
  });

  it("shows an error, and no download, when the PDF can't be built", async () => {
    renderPdf.mockRejectedValue(new Error("This browser can't create PDF files."));
    render(<BusinessExport />);
    fireEvent.click(screen.getByRole("button", { name: /Download business data PDF/ }));
    expect(await screen.findByText("This browser can't create PDF files.")).toBeInTheDocument();
    expect(download).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Download business data PDF/ })).toBeEnabled();
  });
});
