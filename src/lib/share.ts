/** Copy / share helpers. Success is only reported after the browser confirms it. */

export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* permission denied or insecure context: try the fallback */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export type NativeShareResult = "shared" | "cancelled" | "error";

export async function nativeShare(data: { title: string; text: string; url: string }): Promise<NativeShareResult> {
  try {
    await navigator.share(data);
    return "shared";
  } catch (e) {
    return (e as DOMException)?.name === "AbortError" ? "cancelled" : "error";
  }
}

export const canNativeShare = (): boolean => typeof navigator !== "undefined" && typeof navigator.share === "function";
