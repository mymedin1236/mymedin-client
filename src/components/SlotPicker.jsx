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
import { slotsForDay, overlaps, DEFAULT_SLOT_MINUTES } from "../utils/slots";

const pad = (n) => String(n).padStart(2, "0");
// All slot math is in the clinic's timezone (see utils/clinicTime), so the grid
// and booked slots look the same on every device.
const dayStr = clinicDayStr;
const todayStr = clinicToday;

// "09:00" -> "9:00 AM"
const fmt12 = (s) => {
  const [h, m] = s.split(":").map(Number);
  const ap = h < 12 ? "AM" : "PM";
  return `${((h + 11) % 12) + 1}:${pad(m)} ${ap}`;
};

// "20 min" / "1h 30m"
const fmtLen = (mins) => {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

// Interactive day + time-slot picker.
//
// The day's slots come from the clinic's operational-hours brackets, and each
// bracket may run a different KIND of appointment at its own length — so one
// day can offer 20-minute consultations at midday and 90-minute procedures in
// the evening. Where a clinic uses several types the grid is split into a
// labelled section per type; a clinic with a single (or no) type sees the same
// flat grid it always did.
//
// `value` is an ISO datetime string (or ""). `onChange(iso, slot)` also receives
// the chosen slot, so callers can send its appointment type along with the date.
//
// Optional props:
//  - doctorId: fetch a specific doctor's booked slots from the public endpoint
//    (used on the public doctor profile) instead of the viewer's own clinic.
//  - availabilityOverride: use this availability array instead of the fetched one.
//  - readOnly: display availability only — slots aren't selectable.
export default function SlotPicker({
  value,
  onChange,
  excludeId,
  stepMin = DEFAULT_SLOT_MINUTES,
  doctorId,
  availabilityOverride,
  readOnly = false,
  initialDay,
  allowPast = false, // when editing a passed appointment, don't block past days
}) {
  const valueDate = value ? new Date(value) : null;
  // Pre-select a day (e.g. "Add" tapped on a day header) without picking a time,
  // so the doctor still has to choose an actual slot.
  const [day, setDay] = useState(
    valueDate ? dayStr(valueDate) : initialDay || todayStr()
  );
  // Booked intervals for the day: { date, duration } — the duration matters,
  // because a 90-minute booking has to grey out everything it runs through.
  const [booked, setBooked] = useState([]);
  const [fetchedAvailability, setFetchedAvailability] = useState([]);
  // Default slot length (minutes) for brackets that name no type.
  const [fetchedStep, setFetchedStep] = useState(null);
  // Per-date exceptions to the weekly hours (early leave / day off).
  const [dayOverrides, setDayOverrides] = useState([]);
  // The clinic's appointment types, each with its own slot length.
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  // Whether the last fetch failed (slow connection / server cold start). We must
  // NOT fall back to default hours in that case — that would silently show the
  // wrong slots. `null` = never loaded yet; false = loaded OK; true = failed.
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  // Which type's slots to show, or "" for all of them.
  const [typeFilter, setTypeFilter] = useState("");

  // Pull booked datetimes (+ clinic hours + types) for the selected day.
  useEffect(() => {
    if (!day) return;
    // Fetch the booked appointments for the clinic-timezone day [00:00, next 00:00).
    const from = clinicToInstant(day, 0);
    const to = clinicToInstant(day, 24 * 60);
    const endpoint = doctorId ? `/doctors/${doctorId}/booked` : "/appointments/booked";
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
        const step = Number(r.data.slotDuration) || DEFAULT_SLOT_MINUTES;
        // `booked` carries each appointment's length; fall back to the bare
        // start times an older API returns.
        setBooked(
          r.data.booked || (r.data.slots || []).map((date) => ({ date, duration: step }))
        );
        setFetchedAvailability(r.data.availability || []);
        setDayOverrides(r.data.dayOverrides || []);
        setTypes(r.data.appointmentTypes || []);
        if (r.data.slotDuration) setFetchedStep(step);
      })
      .catch(() => {
        if (!active) return;
        setBooked([]);
        setLoadError(true);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [day, excludeId, doctorId, reload]);

  const availability = availabilityOverride || fetchedAvailability;
  // Trust the fetched hours only when the request actually succeeded. When an
  // override is supplied (public profile), the parent already has the hours.
  const hoursKnown = !!availabilityOverride || !loadError;
  const effectiveStep = fetchedStep || stepMin;

  // Every bookable slot for this day, with its type and length. `null` while the
  // hours are still unknown, `[]` when the clinic is closed.
  const slots = useMemo(() => {
    if (!hoursKnown) return null;
    return slotsForDay({
      availability,
      dayOverrides,
      dayStr: day,
      dow: clinicDow(day),
      types,
      defaultDuration: effectiveStep,
    });
  }, [availability, dayOverrides, day, hoursKnown, types, effectiveStep]);

  const isClosed = Array.isArray(slots) && slots.length === 0;

  // The types actually on offer today, in the order their slots appear.
  const typesToday = useMemo(() => {
    const seen = new Map();
    for (const s of slots || []) {
      if (s.typeId && !seen.has(s.typeId)) seen.set(s.typeId, { id: s.typeId, name: s.typeName, duration: s.duration });
    }
    return [...seen.values()];
  }, [slots]);

  // Booked intervals on this day, as [startMin, endMin) in clinic time.
  const bookedRanges = useMemo(() => {
    const out = [];
    for (const b of booked) {
      if (clinicDayStr(b.date) !== day) continue;
      const start = clinicMinutes(b.date);
      out.push([start, start + (Number(b.duration) || effectiveStep)]);
    }
    return out;
  }, [booked, day, effectiveStep]);

  // A slot is taken if ANY booked appointment overlaps the time it occupies —
  // so a 90-minute session at 6:00 correctly closes 6:00 through 7:30, and an
  // off-grid legacy booking still blocks the slot it sits inside.
  const isTaken = (slot) => bookedRanges.some(([s, e]) => overlaps(slot.start, slot.end, s, e));

  const selectedMin =
    valueDate && clinicDayStr(valueDate) === day ? clinicMinutes(valueDate) : null;
  const now = Date.now();

  const pick = (slot) => {
    onChange(clinicToInstant(day, slot.start).toISOString(), slot);
  };

  const shown = (slots || []).filter((s) => !typeFilter || s.typeId === typeFilter);
  // Group into a labelled section per type once the clinic offers more than one;
  // a single-type (or untyped) clinic keeps the original flat grid.
  const groups = useMemo(() => {
    if (typesToday.length < 2 || typeFilter) return [{ key: "all", label: "", slots: shown }];
    const byType = new Map();
    for (const s of shown) {
      const key = s.typeId || "other";
      if (!byType.has(key)) {
        byType.set(key, { key, label: s.typeName || "Other", duration: s.duration, slots: [] });
      }
      byType.get(key).slots.push(s);
    }
    return [...byType.values()];
  }, [shown, typesToday.length, typeFilter]);

  const renderSlot = (slot) => {
    const booked = isTaken(slot);
    const slotTime = clinicToInstant(day, slot.start).getTime();
    const past = slotTime < now;
    const selected = !readOnly && selectedMin === slot.start;
    const cls = `slot${selected ? " selected" : ""}${booked ? " booked" : ""}${
      past && !booked ? " past" : ""
    }`;
    const label = `${fmt12(slot.time)}${slot.typeName ? ` — ${slot.typeName}` : ""} (${fmtLen(
      slot.duration
    )})`;
    const title = booked ? `Booked — ${label}` : past ? `Past — ${label}` : label;
    const key = `${slot.time}-${slot.typeId || "x"}`;
    const body = (
      <>
        {fmt12(slot.time)}
        <span className="slot-len">{fmtLen(slot.duration)}</span>
      </>
    );
    if (readOnly) {
      return (
        <div key={key} className={cls} title={title}>
          {body}
        </div>
      );
    }
    return (
      <button
        key={key}
        type="button"
        className={cls}
        disabled={booked || past}
        title={title}
        aria-label={title}
        onClick={() => pick(slot)}
      >
        {body}
      </button>
    );
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

      {/* Only worth showing when the day actually runs more than one kind. */}
      {typesToday.length > 1 && (
        <div className="slot-type-filter" role="group" aria-label="Filter by appointment type">
          <button
            type="button"
            className={`slot-type-chip${typeFilter === "" ? " on" : ""}`}
            onClick={() => setTypeFilter("")}
          >
            All
          </button>
          {typesToday.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`slot-type-chip${typeFilter === t.id ? " on" : ""}`}
              onClick={() => setTypeFilter(typeFilter === t.id ? "" : t.id)}
            >
              {t.name} <span className="muted">{fmtLen(t.duration)}</span>
            </button>
          ))}
        </div>
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
        groups.map((g) => (
          <div key={g.key} className="slot-group">
            {g.label && (
              <h4 className="slot-group-head">
                {g.label} <span className="muted">· {fmtLen(g.duration)} each</span>
              </h4>
            )}
            <div className={`slot-grid${readOnly ? " readonly" : ""}`}>{g.slots.map(renderSlot)}</div>
          </div>
        ))
      )}
    </div>
  );
}
