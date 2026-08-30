import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Icon from "./Icon";
import {
  clinicDayStr,
  clinicMinutes,
  clinicToday,
  clinicDow,
  clinicToInstant,
} from "../utils/clinicTime";

const pad = (n) => String(n).padStart(2, "0");
// All slot math is in the clinic's timezone (see utils/clinicTime), so the grid
// and booked slots look the same on every device.
const dayStr = clinicDayStr;
const todayStr = clinicToday;

// Matches the day labels the dentist picks at sign up (Register WEEKDAYS).
// JS getDay(): 0=Sun … 6=Sat.
const JS_DAY_TO_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// "09:00" -> "9:00 AM"
const fmt12 = (s) => {
  const [h, m] = s.split(":").map(Number);
  const ap = h < 12 ? "AM" : "PM";
  return `${((h + 11) % 12) + 1}:${pad(m)} ${ap}`;
};

const toMin = (s) => {
  const [h, m] = String(s).split(":").map(Number);
  return h * 60 + (m || 0);
};

const buildSlots = (startMin, endMin, stepMin) => {
  const out = [];
  for (let t = startMin; t < endMin; t += stepMin) {
    out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  }
  return out;
};

// Interactive day + time-slot picker. `value` is an ISO datetime string (or "").
// Slot hours come from the clinic's availability (set by the dentist at sign up);
// when none is configured, falls back to 9:00–6:00.
//
// Optional props:
//  - dentistId: fetch a specific dentist's booked slots from the public endpoint
//    (used on the public dentist profile) instead of the viewer's own clinic.
//  - availabilityOverride: use this availability array instead of the fetched one.
//  - readOnly: display availability only — slots aren't selectable.
export default function SlotPicker({
  value,
  onChange,
  excludeId,
  stepMin = 15,
  dentistId,
  availabilityOverride,
  readOnly = false,
  initialDay,
  allowPast = false, // when editing a passed appointment, don't block past days
}) {
  const valueDate = value ? new Date(value) : null;
  // Pre-select a day (e.g. "Add" tapped on a day header) without picking a time,
  // so the dentist still has to choose an actual slot.
  const [day, setDay] = useState(
    valueDate ? dayStr(valueDate) : initialDay || todayStr()
  );
  const [bookedISO, setBookedISO] = useState([]);
  const [fetchedAvailability, setFetchedAvailability] = useState([]);
  // Slot length (minutes) as configured by the dentist; falls back to `stepMin`.
  const [fetchedStep, setFetchedStep] = useState(null);
  // Per-date exceptions to the weekly hours (early leave / day off).
  const [dayOverrides, setDayOverrides] = useState([]);
  const [loading, setLoading] = useState(false);
  // Whether the last fetch failed (slow connection / server cold start). We must
  // NOT fall back to default hours in that case — that would silently show the
  // wrong slots. `null` = never loaded yet; false = loaded OK; true = failed.
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);

  // Pull booked datetimes (+ clinic hours) for the selected day from the server.
  useEffect(() => {
    if (!day) return;
    // Fetch the booked appointments for the clinic-timezone day [00:00, next 00:00).
    const from = clinicToInstant(day, 0);
    const to = clinicToInstant(day, 24 * 60);
    const endpoint = dentistId ? `/dentists/${dentistId}/booked` : "/appointments/booked";
    let active = true;
    setLoading(true);
    setLoadError(false);
    api
      .get(endpoint, {
        params: { from: from.toISOString(), to: to.toISOString(), exclude: excludeId },
        skipLoader: true,
      })
      .then((r) => {
        if (!active) return;
        setBookedISO(r.data.slots || []);
        setFetchedAvailability(r.data.availability || []);
        setDayOverrides(r.data.dayOverrides || []);
        if (r.data.slotDuration) setFetchedStep(Number(r.data.slotDuration));
      })
      .catch(() => {
        if (!active) return;
        setBookedISO([]);
        setLoadError(true);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [day, excludeId, dentistId, reload]);

  const availability = availabilityOverride || fetchedAvailability;
  // Trust the fetched hours only when the request actually succeeded. When an
  // override is supplied (public profile), the parent already has the hours.
  const hoursKnown = !!availabilityOverride || !loadError;

  // Clinic hours for the selected day, as one or more windows (a day can have a
  // morning AND an evening session). A per-date override wins over the weekly
  // hours for that specific date. Returns null while unknown, [] when closed.
  const windows = useMemo(() => {
    if (!hoursKnown) return null;
    const override = dayOverrides.find((o) => o.date === day);
    if (override) {
      if (override.closed) return []; // day off — no slots
      if (override.start && override.end)
        return [{ start: toMin(override.start), end: toMin(override.end) }];
      // Malformed override -> fall through to weekly hours below.
    }
    const label = JS_DAY_TO_LABEL[clinicDow(day)];
    const entries = availability.filter((a) => a.day === label && a.start && a.end);
    if (entries.length) return entries.map((a) => ({ start: toMin(a.start), end: toMin(a.end) }));
    // No availability configured at all -> sensible default so scheduling still works.
    if (availability.length === 0) return [{ start: 9 * 60, end: 18 * 60 }];
    return []; // configured, but closed on this weekday
  }, [availability, dayOverrides, day, hoursKnown]);

  const isClosed = Array.isArray(windows) && windows.length === 0;

  // Prefer the dentist's configured slot length; fall back to the prop default.
  const effectiveStep = fetchedStep || stepMin;
  const slots = useMemo(() => {
    if (!windows || windows.length === 0) return [];
    const set = new Set();
    for (const w of windows) for (const s of buildSlots(w.start, w.end, effectiveStep)) set.add(s);
    return [...set].sort((a, b) => toMin(a) - toMin(b));
  }, [windows, effectiveStep]);

  // Minutes-since-midnight (clinic time) of every booked appointment on this day.
  const bookedMins = useMemo(() => {
    const out = [];
    for (const iso of bookedISO) {
      if (clinicDayStr(iso) === day) out.push(clinicMinutes(iso));
    }
    return out;
  }, [bookedISO, day]);

  // A grid slot [start, start+step) is taken if ANY booked appointment falls
  // inside that window — even one that doesn't sit exactly on the grid (e.g. an
  // 8:45 booking from an old 15-min grid blocks the 8:40 slot on a 20-min grid).
  // This is what prevents two appointments a few minutes apart on the same chair.
  const isTaken = (slotMin) =>
    bookedMins.some((m) => m >= slotMin && m < slotMin + effectiveStep);

  const selectedMin =
    valueDate && clinicDayStr(valueDate) === day ? clinicMinutes(valueDate) : null;
  const now = Date.now();

  const pick = (slot) => {
    const [h, m] = slot.split(":").map(Number);
    onChange(clinicToInstant(day, h * 60 + m).toISOString());
  };

  return (
    <div className="slotpicker">
      <label>
        <span className="lbl">Day</span>
        <input
          type="date"
          min={allowPast ? undefined : todayStr()}
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </label>
      {day && (
        <p className="slot-day-words">
          {new Date(`${day}T12:00:00Z`).toLocaleDateString([], {
            timeZone: "Asia/Karachi",
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      )}

      <div className="slot-legend-row">
        <div className="slot-legend">
          <span><i className="slot-dot slot-dot-free" /> Available</span>
          <span><i className="slot-dot slot-dot-booked" /> Booked</span>
          {!readOnly && <span><i className="slot-dot slot-dot-sel" /> Selected</span>}
        </div>
        {!readOnly && (
          <button
            type="button"
            className="slot-refresh"
            onClick={() => setReload((n) => n + 1)}
            disabled={loading}
            title="Refresh slots for this day"
          >
            <Icon name="refresh" size={16} className={loading ? "spin" : ""} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        )}
      </div>

      {loading ? (
        <div className={`slot-grid${readOnly ? " readonly" : ""}`} aria-busy="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="slot-skeleton" />
          ))}
        </div>
      ) : loadError && !availabilityOverride ? (
        <div className="slot-error" style={{ margin: "8px 0" }}>
          <p className="muted" style={{ margin: "0 0 8px" }}>
            Couldn't load the clinic hours — the connection may be slow. Please try again.
          </p>
          <button type="button" className="btn-secondary icon" onClick={() => setReload((n) => n + 1)}>
            <Icon name="refresh" size={18} /> Retry
          </button>
        </div>
      ) : isClosed ? (
        <p className="muted" style={{ margin: "8px 0" }}>The clinic is closed on this day.</p>
      ) : (
        <div className={`slot-grid${readOnly ? " readonly" : ""}`}>
          {slots.map((slot) => {
            const [h, m] = slot.split(":").map(Number);
            const slotMin = h * 60 + m;
            const slotTime = clinicToInstant(day, slotMin).getTime();
            const booked = isTaken(slotMin);
            const past = slotTime < now;
            const selected = !readOnly && selectedMin === slotMin;
            const cls = `slot${selected ? " selected" : ""}${booked ? " booked" : ""}${
              past && !booked ? " past" : ""
            }`;
            const title = booked ? "Booked" : past ? "Past" : "Available";
            if (readOnly) {
              return (
                <div key={slot} className={cls} title={title}>
                  {fmt12(slot)}
                </div>
              );
            }
            return (
              <button
                key={slot}
                type="button"
                className={cls}
                disabled={booked || past}
                title={title}
                onClick={() => pick(slot)}
              >
                {fmt12(slot)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
