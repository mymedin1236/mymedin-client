// Helpers for reconciling booked appointments against a doctor's weekly hours.
// Day labels match AvailabilityEditor ("Mon".."Sun"), indexed here by JS getDay().
export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toMin = (s) => {
  const [h, m] = String(s).split(":").map(Number);
  return h * 60 + (m || 0);
};

// Clinic-hours entry (in minutes) for the weekday of `date`, or null if that day is closed.
export function hoursForDate(availability, date) {
  const label = DAY_LABELS[new Date(date).getDay()];
  const e = (availability || []).find((a) => a.day === label);
  if (e?.start && e?.end) return { start: toMin(e.start), end: toMin(e.end) };
  return null;
}

// True if the appointment time falls outside the clinic's hours for its weekday
// (or on a day that is now closed).
export function isOutsideHours(date, availability) {
  const h = hoursForDate(availability, date);
  if (!h) return true;
  const d = new Date(date);
  const mins = d.getHours() * 60 + d.getMinutes();
  return mins < h.start || mins >= h.end;
}

// Future, still-active appointments that would fall outside the given hours —
// e.g. after a doctor shortens/changes their availability.
export function findAvailabilityConflicts(appointments, availability, now = new Date()) {
  return (appointments || [])
    .filter((a) => a.status === "scheduled" || a.status === "pending")
    .filter((a) => new Date(a.date) >= now)
    .filter((a) => isOutsideHours(a.date, availability))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}
