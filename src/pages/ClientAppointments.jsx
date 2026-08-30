import { useEffect, useState } from "react";
import api from "../api/axios";
import { formatDateTime } from "../utils/date";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";
import SlotPicker from "../components/SlotPicker";
import AppointmentActions from "../components/AppointmentActions";
import { SkeletonCards } from "../components/Skeleton";
import { trackAppointment } from "../utils/analytics";

const statusLabel = (s) =>
  s === "pending" ? "Awaiting confirmation" : s === "no_show" ? "No-show" : s;

export default function ClientAppointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [assoc, setAssoc] = useState(null);
  const [deps, setDeps] = useState([]);
  const [loading, setLoading] = useState(true);

  // Request a new appointment
  const [showRequest, setShowRequest] = useState(false);
  const [reqFor, setReqFor] = useState(""); // "" = myself, else dependent id
  const [reqDate, setReqDate] = useState("");
  const [reqReason, setReqReason] = useState("");
  const [reqError, setReqError] = useState("");
  const [reqBusy, setReqBusy] = useState(false);
  const [reqSent, setReqSent] = useState(false);

  const loadAppointments = () =>
    api.get("/appointments", { skipLoader: true }).then((r) => setAppointments(r.data)).catch(() => {});

  useEffect(() => {
    (async () => {
      try {
        const [a, c, f] = await Promise.all([
          api.get("/appointments"),
          api.get("/associations/me"),
          api.get("/family", { skipLoader: true }),
        ]);
        setAppointments(a.data);
        setAssoc(c.data);
        setDeps(f.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openRequest = () => {
    setReqFor("");
    setReqDate("");
    setReqReason("");
    setReqError("");
    setReqSent(false);
    setShowRequest(true);
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    setReqError("");
    if (!reqDate) return setReqError("Please pick a time slot.");
    setReqBusy(true);
    try {
      await api.post("/appointments/request", { date: reqDate, reason: reqReason, for: reqFor || undefined });
      trackAppointment("requested", { doctor_id: assoc?.doctor?._id });
      setShowRequest(false);
      setReqSent(true);
      await loadAppointments();
    } catch (err) {
      setReqError(err.response?.data?.message || "Could not send request.");
    } finally {
      setReqBusy(false);
    }
  };

  // Hide "Request appointment" once the patient already has an active appointment
  // (pending or upcoming). Guardians with dependents keep it so they can still
  // book for a child. The server also blocks same-day double-booking.
  const now = Date.now();
  const hasActiveOwn = appointments.some(
    (a) =>
      a.client?._id === user._id &&
      ["pending", "scheduled"].includes(a.status) &&
      new Date(a.date).getTime() >= now
  );
  const hideRequest = hasActiveOwn && deps.length === 0;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="icon"><Icon name="calendar_month" /> My appointments</h1>
        {assoc?.doctor &&
          (hideRequest ? (
            <span className="muted icon" style={{ fontSize: 14 }}>
              <Icon name="event_available" size={18} /> Appointment already scheduled
            </span>
          ) : (
            <button className="icon" onClick={openRequest}>
              <Icon name="event" size={18} /> Request appointment
            </button>
          ))}
      </div>

      {reqSent && (
        <div className="card" style={{ maxWidth: "none", borderColor: "var(--primary)" }}>
          <p className="icon" style={{ margin: 0 }}>
            <Icon name="schedule_send" size={18} /> Request sent — you'll be notified once your doctor confirms.
          </p>
        </div>
      )}

      {loading ? (
        <SkeletonCards count={4} />
      ) : appointments.length === 0 ? (
        <p className="muted">No appointments yet.</p>
      ) : (
        <div className="appt-list">
          {[...appointments]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map((a) => (
              <div key={a._id} className="appt-card">
                <div className="appt-card-head">
                  <span className="appt-when icon">
                    <Icon name="schedule" size={18} /> {formatDateTime(a.date)}
                  </span>
                  <span className={`st st-${a.status}`}>{statusLabel(a.status)}</span>
                </div>
                <div className="appt-card-body">
                  {a.client && a.client._id !== user._id && (
                    <span className="icon"><Icon name="child_care" size={16} /> For {a.client.name}</span>
                  )}
                  <span className="icon"><Icon name="person" size={16} /> Dr. {a.doctor?.name}</span>
                  {a.reason && (
                    <span className="icon"><Icon name="medical_services" size={16} /> {a.reason}</span>
                  )}
                </div>
                <div className="appt-card-actions">
                  <AppointmentActions appointment={a} onChanged={loadAppointments} />
                </div>
              </div>
            ))}
        </div>
      )}

      {showRequest && (
        <div className="modal-backdrop" onClick={() => setShowRequest(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={submitRequest} style={{ display: "contents" }}>
              <div className="modal-head">
                <h3 className="icon"><Icon name="event" size={18} /> Request an appointment</h3>
                <button type="button" className="modal-close" aria-label="Close" onClick={() => setShowRequest(false)}>
                  <Icon name="close" />
                </button>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                Pick an available slot with Dr. {assoc?.doctor?.name}. They'll confirm your request.
              </p>
              {reqError && <div className="error">{reqError}</div>}
              {deps.length > 0 && (
                <label>
                  <span className="lbl">Who is this for?</span>
                  <select value={reqFor} onChange={(e) => setReqFor(e.target.value)}>
                    <option value="">Myself</option>
                    {deps.map((d) => (
                      <option key={d._id} value={d._id}>{d.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                <span className="lbl">Purpose <span className="muted">(optional)</span></span>
                <input
                  placeholder="e.g. Checkup, Toothache"
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                />
              </label>
              <SlotPicker value={reqDate} onChange={(iso) => setReqDate(iso)} />
              <div className="row gap">
                <button type="submit" className="icon" disabled={reqBusy}>
                  <Icon name="schedule_send" size={18} /> {reqBusy ? "Sending…" : "Send request"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowRequest(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
