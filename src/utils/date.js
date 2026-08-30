// Human-friendly date formatting used across the app.
// "27 June 2026" instead of the confusing "27/06/2026".
//
// All times are shown in the clinic's timezone (Pakistan, Asia/Karachi) so an
// appointment reads the same on every device regardless of its local timezone —
// matching how the slot picker computes availability.
const CLINIC_TZ = "Asia/Karachi";

export const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    timeZone: CLINIC_TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    timeZone: CLINIC_TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

// Time only, always 12-hour — same locale/hour12 as formatDateTime so it never
// falls back to the device's 24-hour clock setting.
export const formatTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", {
    timeZone: CLINIC_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};
