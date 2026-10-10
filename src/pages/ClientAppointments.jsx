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
  // Which of the patient's doctors (dentist, physio, …) this booking is with.
  const [reqDoctor, setReqDoctor] = useState("");
  const [reqDate, setReqDate] = useState("");
  // The slot the patient tapped — carries which kind of appointment that
  // bracket runs, so the request is booked as that type at its own length.
  const [reqSlot, setReqSlot] = useState(null);
  const [reqReason, setReqReason] = useState("");
  const [reqError, setReqError] = useState("");
  const [reqBusy, setReqBusy] = useState(false);
  // null until a booking goes through, then { autoConfirmed } — the clinic may
  // confirm on the spot, in which case there is nothing to wait for.
  const [reqSent, setReqSent] = useState(null);

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

  // Every doctor the patient is with; older servers only send `doctor`.
  const doctors = assoc?.doctors || (assoc?.doctor ? [assoc.doctor] : []);
  const reqDoctorObj = doctors.find((d) => d._id === reqDoctor) || doctors[0];

  const openRequest = () => {
    setReqFor("");
    setReqDoctor(doctors[0]?._id || "");
    setReqSlot(null);
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
      const { data } = await api.post("/appointments/request", {
        date: reqDate,
        reason: reqReason,
        for: reqFor || undefined,
        doctorId: reqDoctorObj?._id,
        appointmentType: reqSlot?.typeId || undefined,
      });
      const autoConfirmed = !!data?.autoConfirmed;
      trackAppointment(autoConfirmed ? "booked" : "requested", { doctor_id: reqDoctorObj?._id });
      setShowRequest(false);
      setReqSent({ autoConfirmed });
      await loadAppointments();
    } catch (err) {
      setReqError(err.response?.data?.message || "Could not send request.");
    } finally {
      setReqBusy(false);
    }
  };

  // Hide "Request appointment" once the patient already has an active appointment
  // (pending or upcoming) with EVERY one of their doctors. Guardians with
  // dependents keep it so they can still book for a child. The server also
  // blocks same-day double-booking.
  const now = Date.now();
  const hasActiveWith = (doctorId) =>
    appointments.some(
      (a) =>
        a.client?._id === user._id &&
        (a.doctor?._id || a.doctor) === doctorId &&
        ["pending", "scheduled"].includes(a.status) &&
        new Date(a.date).getTime() >= now
    );
  const hideRequest = doctors.length > 0 && doctors.every((d) => hasActiveWith(d._id)) && deps.length === 0;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="icon"><Icon name="calendar_month" /> My appointments</h1>
        {doctors.length > 0 &&
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
            {reqSent.autoConfirmed ? (
              <>
                <Icon name="event_available" size={18} /> Appointment confirmed — it's in the
                clinic's diary. We've sent you the details.
              </>
            ) : (
              <>
                <Icon name="schedule_send" size={18} /> Request sent — you'll be notified once your
                doctor confirms.
              </>
            )}
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
                  {a.typeName && (
                    <span className="icon"><Icon name="category" size={16} /> {a.typeName}
                      {a.duration ? <span className="muted"> · {a.duration} min</span> : null}
                    </span>
                  )}
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
                Pick an available slot with Dr. {reqDoctorObj?.name}. They'll confirm your request.
              </p>
              {reqError && <div className="error">{reqError}</div>}
              {doctors.length > 1 && (
                <label>
                  <span className="lbl">Which doctor?</span>
                  <select
                    value={reqDoctorObj?._id || ""}
                    onChange={(e) => {
                      setReqDoctor(e.target.value);
                      // The old slot belongs to the other doctor's diary.
                      setReqDate("");
                      setReqSlot(null);
                    }}
                  >
                    {doctors.map((d) => (
                      <option key={d._id} value={d._id}>
                        Dr. {d.name}
                        {d.specialization ? ` · ${d.specialization}` : d.clinicName ? ` · ${d.clinicName}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
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
              <SlotPicker
                key={reqDoctorObj?._id || "doctor"}
                myDoctorId={reqDoctorObj?._id}
                value={reqDate}
                onChange={(iso, slot) => {
                  setReqDate(iso);
                  setReqSlot(slot);
                }}
              />
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
