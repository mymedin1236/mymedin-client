import { useEffect, useState } from "react";
import api from "../api/axios";
import Icon from "./Icon";

// "Tue, 4 Nov" for a clinic day string.
const fmtDay = (d) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString([], { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

// Shown under the slot picker when the patient's doctor has no free slot on the
// chosen day: the doctor's next free day, and other doctors of the same
// specialty at the same clinic who are free that day.
//
// onPickDay(day)            -> stay with this doctor, jump to that day
// onPickDoctor(doctor, day) -> switch the booking to that doctor on this day
export default function NoSlotAlternatives({ doctorId, doctorName, day, onPickDay, onPickDoctor }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!doctorId || !day) return;
    let active = true;
    setData(null);
    setFailed(false);
    api
      .get("/appointments/alternatives", { params: { doctor: doctorId, date: day }, skipLoader: true })
      .then((r) => active && setData(r.data))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [doctorId, day]);

  if (failed) return null;
  if (!data) return <p className="muted" style={{ margin: "4px 0" }}>Looking for other options…</p>;

  const { nextAvailable, alternatives, clinic } = data;
  if (!nextAvailable && !alternatives.length) {
    return <p className="muted" style={{ margin: "4px 0" }}>No free slots in the next 30 days. Please contact the clinic.</p>;
  }

  return (
    <div className="alt-panel">
      {alternatives.length > 0 && (
        <>
          <p className="alt-head">
            Free on {fmtDay(day)}
            {clinic ? ` at ${clinic.name}` : ""}:
          </p>
          <ul>
            {alternatives.map((a) => (
              <li key={a.doctor._id}>
                <span>
                  <strong>Dr. {a.doctor.name}</strong>
                  <span className="muted">
                    {" "}
                    · {a.hours} · {a.freeCount} free slot{a.freeCount === 1 ? "" : "s"}
                  </span>
                </span>
                <button type="button" className="icon" onClick={() => onPickDoctor(a.doctor, day)}>
                  <Icon name="event_available" size={18} /> Book with Dr. {a.doctor.name.split(" ")[0]}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {nextAvailable && (
        <div className="alt-next">
          <span>
            {alternatives.length ? "Or wait for " : ""}Dr. {doctorName}'s next free day:{" "}
            <strong>{fmtDay(nextAvailable.date)}</strong>
            <span className="muted">
              {" "}
              · {nextAvailable.freeCount} free slot{nextAvailable.freeCount === 1 ? "" : "s"}
            </span>
          </span>
          <button type="button" className="btn-secondary icon" onClick={() => onPickDay(nextAvailable.date)}>
            <Icon name="calendar_month" size={18} /> Show {fmtDay(nextAvailable.date)}
          </button>
        </div>
      )}
    </div>
  );
}
