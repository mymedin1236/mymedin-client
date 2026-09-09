import { useState } from "react";
import Icon from "./Icon";
import { formatDate } from "../utils/date";
import { formatTime12 } from "../utils/time";
import TimeInput12h from "./TimeInput12h";

const todayStr = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

// Every bracket an override defines. Entries saved before appointment types
// existed carry a single `start`/`end` instead of a `blocks` array; reading both
// shapes here is what keeps those old exceptions working untouched.
const bracketsOf = (o) =>
  o.closed ? [] : o.blocks?.length ? o.blocks : o.start && o.end ? [{ start: o.start, end: o.end }] : [];

// Editor for per-date exceptions to the weekly clinic hours: leaving early on a
// specific day, opening late, or taking the day off. `value` is an array of
// { date, closed, blocks: [{ start, end, appointmentType }] }.
//
// Like the weekly hours, one date can hold several brackets, each running its
// own kind of appointment — so a one-off Saturday could be consultations in the
// morning and procedures in the afternoon. These override the normal weekly
// hours for the matching date only, so patients can't book outside the adjusted
// window.
export default function DayOverridesEditor({ value = [], onChange, types = [] }) {
  const [date, setDate] = useState("");
  const [mode, setMode] = useState("hours"); // "hours" | "closed"
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [typeId, setTypeId] = useState("");

  const activeTypes = types.filter((t) => t.active !== false);
  const typeName = (id) => types.find((t) => String(t._id) === String(id));

  const add = () => {
    if (!date) return;
    if (mode === "hours" && (!start || !end || start >= end)) return;

    const others = value.filter((o) => o.date !== date);
    if (mode === "closed") {
      onChange([...others, { date, closed: true, blocks: [] }].sort((a, b) => a.date.localeCompare(b.date)));
    } else {
      // Adding hours to a date that already has some APPENDS a bracket rather
      // than replacing it, so a split day can be built up one bracket at a time.
      const existing = value.find((o) => o.date === date);
      const blocks = [
        ...(existing && !existing.closed ? bracketsOf(existing) : []),
        { start, end, appointmentType: typeId || undefined },
      ].sort((a, b) => a.start.localeCompare(b.start));
      onChange([...others, { date, closed: false, blocks }].sort((a, b) => a.date.localeCompare(b.date)));
    }
    setDate("");
  };

  const remove = (d) => onChange(value.filter((o) => o.date !== d));

  // Drop one bracket; removing the last one removes the exception entirely.
  const removeBlock = (d, idx) =>
    onChange(
      value.flatMap((o) => {
        if (o.date !== d) return [o];
        const blocks = bracketsOf(o).filter((_, i) => i !== idx);
        return blocks.length ? [{ date: o.date, closed: false, blocks }] : [];
      })
    );

  const sorted = [...value].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="override-editor">
      {sorted.length > 0 && (
        <ul className="override-list">
          {sorted.map((o) => {
            const blocks = bracketsOf(o);
            return (
              <li key={o.date} className="override-row">
                <span className="icon">
                  <Icon name="event" size={16} /> {formatDate(`${o.date}T00:00:00`)}
                </span>
                {o.closed ? (
                  <span className="override-tag off">Day off</span>
                ) : (
                  <span className="override-blocks">
                    {blocks.map((b, i) => {
                      const t = typeName(b.appointmentType);
                      return (
                        <span key={i} className="override-tag">
                          {formatTime12(b.start)} – {formatTime12(b.end)}
                          {t && <em className="override-type">{t.name} · {t.duration} min</em>}
                          {blocks.length > 1 && (
                            <button
                              type="button"
                              className="avail-remove"
                              aria-label={`Remove ${b.start}–${b.end} on ${o.date}`}
                              onClick={() => removeBlock(o.date, i)}
                            >
                              <Icon name="close" size={14} />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </span>
                )}
                <button
                  type="button"
                  className="btn-secondary icon override-remove"
                  onClick={() => remove(o.date)}
                  aria-label={`Remove exception for ${o.date}`}
                >
                  <Icon name="delete" size={16} /> Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="override-add">
        <label>
          Date
          <input
            type="date"
            min={todayStr()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          For this day
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="hours">Custom hours</option>
            <option value="closed">Closed (day off)</option>
          </select>
        </label>
        {mode === "hours" && (
          <>
            <div className="override-times">
              <label>
                Opens
                <TimeInput12h aria-label="Opens" value={start} onChange={setStart} />
              </label>
              <label>
                Closes
                <TimeInput12h aria-label="Closes" value={end} onChange={setEnd} />
              </label>
            </div>
            {activeTypes.length > 0 && (
              <label>
                Appointment type
                <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                  <option value="">Default slot length</option>
                  {activeTypes.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} · {t.duration} min
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
        <button type="button" className="btn-secondary icon" onClick={add} disabled={!date}>
          <Icon name="add_circle" size={18} /> Add exception
        </button>
      </div>
    </div>
  );
}
