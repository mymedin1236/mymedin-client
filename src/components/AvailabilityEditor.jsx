import Icon from "./Icon";
import TimeInput12h from "./TimeInput12h";
import { formatTime12 } from "../utils/time";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Per-day clinic hours editor. `value` is a flat array of { day, start, end }.
// A day may have MORE THAN ONE block (e.g. a morning 10:00–13:30 and an evening
// 16:00–21:00 session); each is one entry sharing the same `day`.
export default function AvailabilityEditor({ value = [], onChange }) {
  const byDay = {};
  value.forEach((v) => {
    (byDay[v.day] ||= []).push(v);
  });

  // Replace all blocks for `day`, re-emitting the whole array in weekday order.
  const emit = (day, blocks) => {
    const next = [];
    for (const d of WEEKDAYS) {
      if (d === day) next.push(...blocks);
      else next.push(...(byDay[d] || []));
    }
    onChange(next);
  };

  const toggle = (day) =>
    emit(day, byDay[day]?.length ? [] : [{ day, start: "09:00", end: "17:00" }]);
  const addBlock = (day) => emit(day, [...(byDay[day] || []), { day, start: "16:00", end: "21:00" }]);
  const removeBlock = (day, idx) => emit(day, (byDay[day] || []).filter((_, i) => i !== idx));
  const setTime = (day, idx, field, t) =>
    emit(day, (byDay[day] || []).map((b, i) => (i === idx ? { ...b, [field]: t } : b)));

  // Most clinics keep the same hours every day — let the doctor set one day
  // and copy it everywhere instead of repeating the same entry seven times.
  const copyToAllDays = (day) => {
    const blocks = byDay[day] || [];
    if (!blocks.length) return;
    const summary = blocks.map((b) => `${formatTime12(b.start)}–${formatTime12(b.end)}`).join(", ");
    if (!window.confirm(`Use ${day}'s hours (${summary}) for every day? This replaces any other days' hours.`)) {
      return;
    }
    onChange(WEEKDAYS.flatMap((d) => blocks.map((b) => ({ ...b, day: d }))));
  };

  return (
    <div className="avail-editor">
      {WEEKDAYS.map((day) => {
        const blocks = byDay[day] || [];
        const open = blocks.length > 0;
        return (
          <div className={`avail-row${open ? " open" : ""}`} key={day}>
            <button
              type="button"
              className={`avail-day${open ? " on" : ""}`}
              onClick={() => toggle(day)}
              aria-pressed={open}
            >
              <Icon name={open ? "check_circle" : "radio_button_unchecked"} size={18} /> {day}
            </button>
            {open ? (
              <div className="avail-blocks">
                {blocks.map((b, i) => (
                  <div className="avail-times" key={i}>
                    <TimeInput12h
                      aria-label={`${day} opening time`}
                      value={b.start}
                      onChange={(t) => setTime(day, i, "start", t)}
                    />
                    <span className="avail-dash">–</span>
                    <TimeInput12h
                      aria-label={`${day} closing time`}
                      value={b.end}
                      onChange={(t) => setTime(day, i, "end", t)}
                    />
                    {blocks.length > 1 && (
                      <button
                        type="button"
                        className="avail-remove"
                        aria-label="Remove this time block"
                        onClick={() => removeBlock(day, i)}
                      >
                        <Icon name="close" size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <div className="avail-block-actions">
                  <button type="button" className="btn-secondary avail-add icon" onClick={() => addBlock(day)}>
                    <Icon name="add" size={16} /> Add hours
                  </button>
                  <button
                    type="button"
                    className="btn-secondary avail-add icon"
                    onClick={() => copyToAllDays(day)}
                    title={`Use ${day}'s hours for every day`}
                  >
                    <Icon name="content_copy" size={16} /> Use for all days
                  </button>
                </div>
              </div>
            ) : (
              <span className="muted">Closed</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
