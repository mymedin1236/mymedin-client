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

// Editor for per-date exceptions to the weekly clinic hours: leaving early on a
// specific day, opening late, or taking the day off. `value` is an array of
// { date, closed, start, end }. These override the normal weekly hours for the
// matching date only, so patients can't book outside the adjusted window.
export default function DayOverridesEditor({ value = [], onChange }) {
  const [date, setDate] = useState("");
  const [mode, setMode] = useState("hours"); // "hours" | "closed"
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");

  const add = () => {
    if (!date) return;
    if (mode === "hours" && (!start || !end || start >= end)) return;
    const entry =
      mode === "closed"
        ? { date, closed: true }
        : { date, closed: false, start, end };
    // Replace any existing exception for the same date.
    onChange([...value.filter((o) => o.date !== date), entry].sort((a, b) => a.date.localeCompare(b.date)));
    setDate("");
  };

  const remove = (d) => onChange(value.filter((o) => o.date !== d));

  const sorted = [...value].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="override-editor">
      {sorted.length > 0 && (
        <ul className="override-list">
          {sorted.map((o) => (
            <li key={o.date} className="override-row">
              <span className="icon">
                <Icon name="event" size={16} /> {formatDate(`${o.date}T00:00:00`)}
              </span>
              <span className={`override-tag${o.closed ? " off" : ""}`}>
                {o.closed ? "Day off" : `${formatTime12(o.start)} – ${formatTime12(o.end)}`}
              </span>
              <button
                type="button"
                className="btn-secondary icon override-remove"
                onClick={() => remove(o.date)}
                aria-label={`Remove exception for ${o.date}`}
              >
                <Icon name="delete" size={16} /> Remove
              </button>
            </li>
          ))}
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
        )}
        <button type="button" className="btn-secondary icon" onClick={add} disabled={!date}>
          <Icon name="add_circle" size={18} /> Add exception
        </button>
      </div>
    </div>
  );
}
