import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { Alert } from "./AuthLayout";
import { whatsappLink } from "../lib/sales";

interface Props {
  /** File name for the PDF, e.g. receipt-RC-000012.pdf */
  filename: string;
  makePdf: () => Promise<Blob>;
  shareTitle: string;
  shareText: string;
  /** Message used when the PDF can't be attached automatically and WhatsApp is opened instead. */
  whatsappMessage: string;
  customerPhone: string | null;
  backTo: string;
  backLabel: string;
  extra?: ReactNode;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Save as PDF / share on WhatsApp / back. Shared by the receipt and invoice pages. */
export function DocumentActions({ filename, makePdf, shareTitle, shareText, whatsappMessage, customerPhone, backTo, backLabel, extra }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);

  const saveAsPdf = async () => {
    setBusy(true);
    setError(null);
    try {
      download(await makePdf(), filename);
    } catch {
      setError("We couldn't create the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const sharePdf = async () => {
    setBusy(true);
    setError(null);
    try {
      const blob = await makePdf();
      const file = new File([blob], filename, { type: "application/pdf" });
      const shareApi = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
        share?: (data?: ShareData) => Promise<void>;
      };
      if (shareApi.share && shareApi.canShare?.({ files: [file] })) {
        try {
          await shareApi.share({ files: [file], title: shareTitle, text: shareText });
          setFallback(null);
          return;
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === "AbortError") return;
        }
      }
      download(blob, filename);
      setFallback(whatsappLink(whatsappMessage, customerPhone));
    } catch {
      setError("We couldn't create the PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="receipt-actions no-print">
        <button className="btn btn-primary" onClick={() => void saveAsPdf()} disabled={busy}>
          {busy ? "Preparing…" : "Save as PDF"}
        </button>
        <button className="btn btn-outline" onClick={() => void sharePdf()} disabled={busy}>
          <MessageCircle size={16} aria-hidden="true" /> Share PDF on WhatsApp
        </button>
        {extra}
        <Link className="btn btn-outline" to={backTo}>
          {backLabel}
        </Link>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {fallback && (
        <p className="receipt-share-fallback no-print" role="status">
          The PDF is saved to your device. Open WhatsApp and attach <b>{filename}</b> to send it.
          <a href={fallback} target="_blank" rel="noopener noreferrer">
            {" "}
            Open WhatsApp
          </a>
        </p>
      )}
    </>
  );
}
