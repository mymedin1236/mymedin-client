// Clinic timezone helpers.
//
// Every appointment/slot time is computed in the CLINIC's fixed timezone —
// Pakistan Standard Time (UTC+5, no daylight saving) — NOT the viewing device's
// local timezone. This makes the schedule identical on every phone and laptop,
// regardless of each device's timezone setting. (If the product ever serves
// clinics outside Pakistan, switch to a per-clinic IANA timezone here.)

const CLINIC_OFFSET_MIN = 5 * 60; // PKT is UTC+5

const pad = (n) => String(n).padStart(2, "0");

// Wall-clock parts of an absolute instant, read in clinic time.
const partsOf = (date) => {
  const s = new Date(new Date(date).getTime() + CLINIC_OFFSET_MIN * 60000);
  return {
    y: s.getUTCFullYear(),
    mo: s.getUTCMonth(),
    d: s.getUTCDate(),
    h: s.getUTCHours(),
    mi: s.getUTCMinutes(),
    dow: s.getUTCDay(),
  };
};

// "YYYY-MM-DD" for an instant, in clinic time.
export const clinicDayStr = (date) => {
  const p = partsOf(date);
  return `${p.y}-${pad(p.mo + 1)}-${pad(p.d)}`;
};

// "HH:MM" for an instant, in clinic time.
export const clinicHM = (date) => {
  const p = partsOf(date);
  return `${pad(p.h)}:${pad(p.mi)}`;
};

// Minutes since clinic midnight for an instant.
export const clinicMinutes = (date) => {
  const p = partsOf(date);
  return p.h * 60 + p.mi;
};

// Today's date string in clinic time.
export const clinicToday = () => clinicDayStr(new Date());

// Day of week (0=Sun … 6=Sat) for a "YYYY-MM-DD" clinic day.
export const clinicDow = (dayStr) => {
  const [y, mo, d] = dayStr.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
};

// Absolute Date for a clinic-local day ("YYYY-MM-DD") + minutes-since-midnight.
// e.g. clinicToInstant("2026-08-08", 520) -> the instant that is 08:40 in PKT.
export const clinicToInstant = (dayStr, minutes = 0) => {
  const [y, mo, d] = dayStr.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 0, minutes, 0) - CLINIC_OFFSET_MIN * 60000);
};
