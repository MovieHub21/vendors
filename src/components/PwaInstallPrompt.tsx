import { useEffect, useRef, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const SESSION_KEY = "sellsharp:pwa-install-prompt-shown";
let deferredPrompt: InstallPromptEvent | null = null;
const promptListeners = new Set<(event: InstallPromptEvent | null) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    if (!window.location.pathname.startsWith("/dashboard")) return;
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    promptListeners.forEach((listener) => listener(deferredPrompt));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    promptListeners.forEach((listener) => listener(null));
  });
}

function isInstalledApp() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

function wasPromptedThisSession() {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markPromptedThisSession() {
  if (wasPromptedThisSession()) return false;
  try {
    window.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // The in-memory state still prevents repeated prompts until this page is refreshed.
  }
  return true;
}

function isIosDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isSafari() {
  return /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);
}

export function PwaInstallPrompt() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [inSafari, setInSafari] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(deferredPrompt);

  useEffect(() => {
    if (isInstalledApp() || wasPromptedThisSession()) return;

    const showInstallPrompt = (event: InstallPromptEvent | null) => {
      setInstallEvent(event);
      if (!event) {
        dialogRef.current?.close();
        return;
      }
      if (!markPromptedThisSession()) return;
      setIsIos(false);
      setIsOpen(true);
    };
    promptListeners.add(showInstallPrompt);
    if (deferredPrompt) showInstallPrompt(deferredPrompt);

    if (isIosDevice() && markPromptedThisSession()) {
      setIsIos(true);
      setInSafari(isSafari());
      setIsOpen(true);
    }

    const androidFallback = /Android/i.test(navigator.userAgent) && !deferredPrompt;
    const fallbackTimer = androidFallback
      ? window.setTimeout(() => {
          if (!markPromptedThisSession()) return;
          setIsAndroid(true);
          setIsOpen(true);
        }, 1400)
      : undefined;

    return () => {
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
      promptListeners.delete(showInstallPrompt);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  async function install() {
    const prompt = installEvent;
    if (!prompt) return;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      // The browser may invalidate the one-use prompt between it being offered and the tap.
    } finally {
      deferredPrompt = null;
      setInstallEvent(null);
      dialogRef.current?.close();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="pwa-install-dialog"
      aria-labelledby="pwa-install-title"
      aria-describedby="pwa-install-benefit"
      onClose={() => setIsOpen(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
    >
      <div className="pwa-install-content">
        <p className="pwa-install-eyebrow">SellSharp app</p>
        <h2 id="pwa-install-title">{isIos ? "Add SellSharp to your Home Screen" : "Install SellSharp"}</h2>
        <p id="pwa-install-benefit" className="pwa-install-intro">
          Keep your shop close and get back to orders faster.
        </p>
        <div className="pwa-install-benefit">
          <strong>A quicker way to run your shop</strong>
          <p>Open SellSharp from your Home Screen in its own app-like window.</p>
        </div>

        {isIos ? (
          <div className="pwa-ios-steps">
            {!inSafari && <p>First, open this page in Safari.</p>}
            <ol>
              <li>In Safari, tap the Share button.</li>
              <li>Scroll the menu and choose <b>Add to Home Screen</b>.</li>
              <li>Tap <b>Add</b>. Turn on <b>Open as Web App</b> if that option appears.</li>
            </ol>
          </div>
        ) : installEvent ? (
          <button type="button" className="btn btn-primary pwa-install-action" onClick={() => void install()} disabled={!installEvent}>
            Install SellSharp
          </button>
        ) : isAndroid ? (
          <div className="pwa-ios-steps">
            <p>Open your browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>.</p>
          </div>
        ) : null}
        <button type="button" className="pwa-install-dismiss" onClick={() => dialogRef.current?.close()}>
          Maybe later
        </button>
      </div>
    </dialog>
  );
}
