import api from "./api/axios";

// VAPID public key (base64url) -> Uint8Array for applicationServerKey
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Request permission and register a push subscription. Best-effort; safe to call repeatedly.
// Resolves to a status so callers can tell the user why it didn't work, instead of
// failing silently: "subscribed" | "denied" | "unsupported" | "unconfigured" | "error".
export async function subscribeToPush() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
    if (Notification.permission === "denied") return "denied";

    const { data } = await api.get("/push/public-key", { skipLoader: true });
    if (!data?.publicKey) return "unconfigured"; // push not configured on server

    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return "denied";
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });
    }

    const json = sub.toJSON();
    await api.post(
      "/push/subscribe",
      { endpoint: json.endpoint, keys: json.keys },
      { skipLoader: true }
    );
    return "subscribed";
  } catch {
    return "error"; // push is a best-effort enhancement — caller decides whether to surface this
  }
}

// Remove this device's push subscription (used when the user turns notifications off).
export async function unsubscribeFromPush() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api.post("/push/unsubscribe", { endpoint: sub.endpoint }, { skipLoader: true });
      await sub.unsubscribe();
    }
  } catch {
    /* ignore */
  }
}
