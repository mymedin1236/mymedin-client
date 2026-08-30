import { useEffect, useState } from "react";
import api from "../api/axios";
import { formatDateTime } from "../utils/date";
import Icon from "./Icon";
import SlotPicker from "./SlotPicker";
import { trackAppointment } from "../utils/analytics";

// Elapsed waiting time since the patient marked themselves arrived.
const waitLabel = (arrivedAt, now) => {
  const m = Math.max(0, Math.floor((now - new Date(arrivedAt).getTime()) / 60000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
};

// Reschedule + Cancel actions for a patient's own appointment.
// Only renders for active appointments (scheduled / pending). Calls onChanged()
// after a successful change so the parent can refresh its list.
export default function AppointmentActions({ appointment, onChanged }) {
  const a = appointment;
  const active = a.status === "scheduled" || a.status === "pending";
  const future = new Date(a.date) > new Date();
  const isToday = new Date(a.date).toDateString() === new Date().toDateString();
  // Travel buttons only for a confirmed appointment on its day.
  const showArrival = a.status === "scheduled" && isToday;

  const [reschedOpen, setReschedOpen] = useState(false);
  const [reschedDate, setReschedDate] = useState(a.date);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [arrBusy, setArrBusy] = useState(false);
  const [justArrived, setJustArrived] = useState(false); // show confirmation on click
  // Ticks every 30s so the patient's own waiting timer advances live.
  const [nowTick, setNowTick] = useState(() => Date.now());

  const arrived = a.status === "scheduled" && a.arrivalStatus === "arrived";
  useEffect(() => {
    if (!arrived) return;
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, [arrived]);

  if (!active) return null;

  const sendArrival = async (status) => {
    setArrBusy(true);
    try {
      await api.patch(`/appointments/${a._id}/arrival`, { status });
      trackAppointment("arrival_updated", {
        appointment_id: a._id,
        arrival_status: status,
        actor: "patient",
      });
      if (status === "arrived") {
        setNowTick(Date.now());
        setJustArrived(true);
      }
      onChanged?.();
    } catch (e2) {
      alert(e2.response?.data?.message || "Could not update.");
    } finally {
      setArrBusy(false);
    }
  };

  const openReschedule = () => {
    setReschedDate(a.date);
    setErr("");
    setReschedOpen(true);
  };

  const submitReschedule = async (e) => {
    e.preventDefault();
    if (!reschedDate) return setErr("Pick a new date and time.");
    if (new Date(reschedDate).getTime() < Date.now())
      return setErr("Appointment cannot be in the past.");
    setBusy(true);
    try {
      await api.patch(`/appointments/${a._id}/reschedule`, { date: reschedDate });
      trackAppointment("rescheduled", { appointment_id: a._id, actor: "patient" });
      setReschedOpen(false);
      onChanged?.();
    } catch (e2) {
      setErr(e2.response?.data?.message || "Could not reschedule.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!confirm("Cancel this appointment?")) return;
    setCancelling(true);
    try {
      await api.patch(`/appointments/${a._id}/cancel`);
      trackAppointment("cancelled", { appointment_id: a._id, actor: "patient" });
      onChanged?.();
    } catch (e2) {
      alert(e2.response?.data?.message || "Could not cancel.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="appt-actions-contents">
      {showArrival && a.arrivalStatus === "arrived" ? (
        <div className="arrived-panel">
          <div className="arrived-panel-row">
            <span className="clinic-badge open">
              <Icon name="where_to_vote" size={16} /> Marked arrived
            </span>
            {a.arrivedAt && (
              <span className="wait-badge">
                <Icon name="timer" size={14} /> Waiting {waitLabel(a.arrivedAt, nowTick)}
              </span>
            )}
          </div>
          <p className="arrived-note icon">
            <Icon name="check_circle" size={14} />
            {justArrived
              ? "Your timer has started — the clinic can see how long you've been waiting."
              : "Your waiting time is being tracked by the clinic."}
          </p>
        </div>
      ) : showArrival && a.arrivalStatus === "on_the_way" ? (
        <>
          <span className="badge icon">
            <Icon name="directions_car" size={14} /> On the way
          </span>
          <button
            className="btn-secondary icon"
            style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
            onClick={() => sendArrival("arrived")}
            disabled={arrBusy}
          >
            <Icon name="where_to_vote" size={18} /> I've arrived
          </button>
        </>
      ) : showArrival ? (
        <button
          className="btn-secondary icon"
          onClick={() => sendArrival("on_the_way")}
          disabled={arrBusy}
        >
          <Icon name="directions_car" size={18} /> On my way
        </button>
      ) : null}
      {future && (
        <button className="btn-secondary icon" onClick={openReschedule}>
          <Icon name="edit_calendar" size={18} /> Reschedule
        </button>
      )}
      <button className="btn-secondary icon btn-cancel" onClick={cancel} disabled={cancelling}>
        <Icon name="cancel" size={18} /> {cancelling ? "Cancelling…" : "Cancel"}
      </button>

      {reschedOpen && (
        <div className="modal-backdrop" onClick={() => setReschedOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={submitReschedule} style={{ display: "contents" }}>
              <div className="modal-head">
                <h3 className="icon"><Icon name="edit_calendar" size={18} /> Reschedule appointment</h3>
                <button type="button" className="modal-close" aria-label="Close" onClick={() => setReschedOpen(false)}>
                  <Icon name="close" />
                </button>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                {a.reason ? `${a.reason} — ` : ""}with Dr. {a.doctor?.name} — currently {formatDateTime(a.date)}
              </p>
              {err && <div className="error">{err}</div>}
              <SlotPicker value={reschedDate} excludeId={a._id} onChange={(iso) => setReschedDate(iso)} />
              <div className="row gap">
                <button type="submit" className="icon" disabled={busy}>
                  <Icon name="check" size={18} /> {busy ? "Saving…" : "Confirm reschedule"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setReschedOpen(false)}>
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
