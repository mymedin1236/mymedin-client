// Helpers for converting between the "HH:mm" 24-hour strings stored/sent to
// the API and the 12-hour hour/minute/AM-PM parts used by the UI.

export function to12hParts(hhmm) {
  const [h, m] = (hhmm || "09:00").split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour12 = ((h + 11) % 12) + 1;
  return { hour12, minute: m || 0, period };
}

export function to24h(hour12, minute, period) {
  let h = hour12 % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// "17:00" -> "5:00 PM"
export function formatTime12(hhmm) {
  if (!hhmm) return hhmm;
  const { hour12, minute, period } = to12hParts(hhmm);
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}
