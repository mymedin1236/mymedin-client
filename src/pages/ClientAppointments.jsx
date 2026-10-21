import { useEffect, useState } from "react";
import api from "../api/axios";
import { formatDateTime } from "../utils/date";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";
import AppointmentActions from "../components/AppointmentActions";
import { SkeletonCards } from "../components/Skeleton";
import RequestAppointment, { RequestSentNote, allDoctorsBooked } from "../components/RequestAppointment";

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
  // null until a booking goes through, then { autoConfirmed }.
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

  const hideRequest = allDoctorsBooked({ appointments, doctors, deps, userId: user._id });

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
            <button className="icon" onClick={() => {
              setReqSent(null);
              setShowRequest(true);
            }}>
              <Icon name="event" size={18} /> Request appointment
            </button>
          ))}
      </div>

      {reqSent && <RequestSentNote autoConfirmed={reqSent.autoConfirmed} />}

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
        <RequestAppointment
          doctors={doctors}
          deps={deps}
          onClose={() => setShowRequest(false)}
          onSent={(sent) => {
            setShowRequest(false);
            setReqSent(sent);
            loadAppointments();
          }}
        />
      )}
    </div>
  );
}
