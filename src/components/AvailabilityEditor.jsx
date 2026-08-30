import Icon from "./Icon";

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
                    <input
                      type="time"
                      value={b.start}
                      onChange={(e) => setTime(day, i, "start", e.target.value)}
                    />
                    <span className="avail-dash">–</span>
                    <input
                      type="time"
                      value={b.end}
                      onChange={(e) => setTime(day, i, "end", e.target.value)}
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
                <button type="button" className="btn-secondary avail-add icon" onClick={() => addBlock(day)}>
                  <Icon name="add" size={16} /> Add hours
                </button>
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
