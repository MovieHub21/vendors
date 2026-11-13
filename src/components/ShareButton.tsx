import { useState, useSyncExternalStore } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { absoluteUrl } from "../lib/site";
import { canNativeShare, copyText, nativeShare } from "../lib/share";

const noopSubscribe = () => () => {};

/**
 * Share / copy-link actions for a store or a product.
 * The link is ALWAYS built from the canonical path + the production origin (never window.location), so it can't be a
 * localhost, staging or temporary address, and it identifies the exact page without any browser state.
 */
export function ShareButton({
  path,
  kind,
  title,
  text,
}: {
  path: string;
  kind: "store" | "product";
  title: string;
  text: string;
}) {
  const url = absoluteUrl(path);
  const native = useSyncExternalStore(noopSubscribe, canNativeShare, () => false);
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const noun = kind === "store" ? "store" : "product";

  async function copy() {
    const ok = await copyText(url);
    setStatus(ok ? "copied" : "failed");
    if (ok) window.setTimeout(() => setStatus("idle"), 3500);
  }

  async function share() {
    const result = await nativeShare({ title, text, url });
    if (result === "error") await copy(); // native sheet unavailable at that moment: fall back to copying
  }

  return (
    <div className="share-actions">
      {native && (
        <button type="button" className="btn btn-outline share-btn" onClick={share}>
          <Share2 size={15} aria-hidden="true" /> Share {noun}
        </button>
      )}
      <button type="button" className="btn btn-outline share-btn" onClick={copy}>
        {status === "copied" ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />} Copy{" "}
        {noun} link
      </button>
      <span className="share-status" role="status" aria-live="polite">
        {status === "copied" && `${noun === "store" ? "Store" : "Product"} link copied`}
      </span>
      {status === "failed" && (
        <label className="share-manual">
          Couldn't copy automatically. Select the link below and copy it:
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        </label>
      )}
    </div>
  );
}
