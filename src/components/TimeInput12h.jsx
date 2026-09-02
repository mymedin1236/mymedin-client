import { to12hParts, to24h } from "../utils/time";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

// A 12-hour hour/minute/AM-PM time picker that reads and writes the same
// "HH:mm" 24-hour string the API stores, so callers don't need to change.
export default function TimeInput12h({ value, onChange, "aria-label": ariaLabel }) {
  const { hour12, minute, period } = to12hParts(value);
  const update = (h, m, p) => onChange(to24h(h, m, p));

  return (
    <span className="time-input-12h" role="group" aria-label={ariaLabel}>
      <select
        aria-label={ariaLabel ? `${ariaLabel} hour` : "Hour"}
        value={hour12}
        onChange={(e) => update(Number(e.target.value), minute, period)}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="time-input-12h-sep">:</span>
      <select
        aria-label={ariaLabel ? `${ariaLabel} minute` : "Minute"}
        value={minute}
        onChange={(e) => update(hour12, Number(e.target.value), period)}
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
        ))}
      </select>
      <select
        aria-label={ariaLabel ? `${ariaLabel} AM/PM` : "AM/PM"}
        value={period}
        onChange={(e) => update(hour12, minute, e.target.value)}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </span>
  );
}
