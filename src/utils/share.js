// Share text through the OS share sheet so the user can choose which app to use
// — e.g. WhatsApp vs WhatsApp Business when both are installed. Falls back to a
// WhatsApp click-to-chat link (opens the default WhatsApp) when the Web Share
// API isn't available (typically desktop browsers).
export async function shareViaSheet({ text, fallbackUrl }) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      // User dismissed the sheet — don't then open a link behind their back.
      if (e && e.name === "AbortError") return;
      // Any other failure: fall through to the link.
    }
  }
  if (fallbackUrl) window.open(fallbackUrl, "_blank", "noopener");
}
