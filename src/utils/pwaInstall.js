import { useEffect, useState } from "react";

// Capture the install prompt at module load (the browser may fire it before any
// component mounts). The button only shows when this event is available — which
// the browser fires ONLY when the PWA is installable and NOT already installed.
let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

// iOS Safari has no beforeinstallprompt — installs are manual via Share sheet.
export const isIos = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
  (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

const canInstall = () => !!deferredPrompt && !isStandalone();

async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return outcome === "accepted";
}

// Hook: { canInstall, install, iosHint } — canInstall flips to false once installed;
// iosHint is true on an iPhone/iPad that hasn't installed it yet (manual install).
export function usePwaInstall() {
  const [show, setShow] = useState(canInstall());
  useEffect(() => {
    const update = () => setShow(canInstall());
    listeners.add(update);
    update();
    return () => listeners.delete(update);
  }, []);
  return { canInstall: show, install: promptInstall, iosHint: isIos() && !isStandalone() };
}
