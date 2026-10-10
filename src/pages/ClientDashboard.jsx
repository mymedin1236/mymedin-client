import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { formatDateTime } from "../utils/date";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";
import Avatar from "../components/Avatar";
import StarRating from "../components/StarRating";
import AppointmentActions from "../components/AppointmentActions";

const statusLabel = (s) =>
  s === "pending" ? "Awaiting confirmation" : s === "no_show" ? "No-show" : s;

const money = (n) => `Rs ${(Number(n) || 0).toLocaleString("en-US")}`;

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const toMin = (s) => {
  const [h, m] = String(s).split(":").map(Number);
  return h * 60 + (m || 0);
};
const fmt12 = (s) => {
  const [h, m] = String(s).split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

// Live open/closed status for a clinic, from its per-day availability.
const clinicStatus = (availability) => {
  if (!availability?.length) return null;
  const now = new Date();
  const entry = availability.find((a) => a.day === WEEK[now.getDay()]);
  if (!entry || !entry.start || !entry.end)
    return { kind: "closed", icon: "block", text: "Closed today" };
  const start = toMin(entry.start);
  const end = toMin(entry.end);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin >= end) return { kind: "closed", icon: "block", text: "Closed for today" };
  if (nowMin < start) {
    const diff = start - nowMin;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    const inText = h > 0 ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
    return { kind: "soon", icon: "schedule", text: `Opens in ${inText} (${fmt12(entry.start)})` };
  }
  return { kind: "open", icon: "check_circle", text: `Open now · closes ${fmt12(entry.end)}` };
};

// Patient "Home" tab. Three sections: (1) scheduled appointment, (2) payments /
// outstanding balance, (3) review your doctor.
export default function ClientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assoc, setAssoc] = useState(null); // { doctors, pendings, … }
  const [upcoming, setUpcoming] = useState([]);
  const [outstanding, setOutstanding] = useState(0);
  const [leaveDoctor, setLeaveDoctor] = useState(null); // doctor being left, or null
  const [leaveRating, setLeaveRating] = useState(5);
  const [leaveComment, setLeaveComment] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [assocNotice, setAssocNotice] = useState("");

  const loadAssoc = () =>
    api.get("/associations/me").then((r) => setAssoc(r.data)).catch(() => {});

  // Upcoming = active (scheduled or pending) appointments that are today or later.
  // We compare against the START of today, not the current minute, so an
  // appointment doesn't vanish the instant its start time passes — a patient who
  // is a few minutes late still sees today's appointment until the day ends (it
  // only leaves once the clinic marks it completed/cancelled/no-show).
  const loadUpcoming = () =>
    api
      .get("/appointments", { skipLoader: true })
      .then((r) => {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const todayStart = startOfToday.getTime();
        const list = (r.data || [])
          .filter(
            (a) =>
              ["scheduled", "pending"].includes(a.status) &&
              new Date(a.date).getTime() >= todayStart
          )
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        // Defensive: collapse any accidental duplicate records for the same
        // patient + doctor + slot so the same appointment never shows twice.
        const seen = new Set();
        const deduped = list.filter((a) => {
          const key = `${a.client?._id || a.client}|${a.doctor?._id || a.doctor}|${a.date}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setUpcoming(deduped);
      })
      .catch(() => {});

  // Total unpaid balance across the patient's treatments.
  const loadBalance = () =>
    api
      .get("/treatments", { skipLoader: true })
      .then((r) => {
        const total = (r.data || []).reduce((s, t) => s + (Number(t.balance) || 0), 0);
        setOutstanding(Math.round(total));
      })
      .catch(() => {});

  useEffect(() => {
    loadAssoc();
    loadUpcoming();
    loadBalance();
  }, []);

  // If the patient arrived via the public "Associate with this clinic" flow,
  // send the association request now that they're signed in.
  useEffect(() => {
    const raw = sessionStorage.getItem("pendingAssociation");
    if (!raw) return;
    sessionStorage.removeItem("pendingAssociation");
    let pend;
    try {
      pend = JSON.parse(raw);
    } catch {
      return;
    }
    if (!pend?.id) return;
    api
      .post("/associations/request", { doctorId: pend.id })
      .then(() => {
        setAssocNotice(
          `Request sent to Dr. ${pend.name || "your selected doctor"} — you'll be notified once they confirm.`
        );
        loadAssoc();
        window.dispatchEvent(new Event("association-changed"));
      })
      .catch((err) =>
        setAssocNotice(err.response?.data?.message || "Could not send your association request.")
      );
  }, []);

  const disassociate = async () => {
    setLeaving(true);
    try {
      await api.post("/associations/disassociate", {
        doctorId: leaveDoctor?._id,
        rating: leaveRating,
        comment: leaveComment,
      });
      setLeaveDoctor(null);
      setLeaveComment("");
      await loadAssoc();
      await loadUpcoming();
      window.dispatchEvent(new Event("association-changed"));
    } catch (err) {
      console.error(err);
    } finally {
      setLeaving(false);
    }
  };

  const renderAppointment = (a) => {
    // Start time has passed but the appointment is still active (not yet
    // completed/cancelled) — reassure a late patient instead of hiding it.
    const started =
      a.status === "scheduled" && new Date(a.date).getTime() < Date.now();
    return (
    <div key={a._id} className="appt-card">
      <div className="appt-card-head">
        <span className="appt-when icon">
          <Icon name="schedule" size={18} /> {formatDateTime(a.date)}
        </span>
        <span className={`st st-${a.status}`}>{statusLabel(a.status)}</span>
      </div>
      {started && (
        <p className="appt-late icon">
          <Icon name="info" size={16} /> Scheduled time has started — running late?
          Let the clinic know you're on your way.
        </p>
      )}
      <div className="appt-card-body">
        {a.client && a.client._id !== user._id && (
          <span className="icon"><Icon name="child_care" size={16} /> For {a.client.name}</span>
        )}
        <span className="icon"><Icon name="person" size={16} /> Dr. {a.doctor?.name}</span>
        {a.doctor?.clinicName && (
          <span className="icon"><Icon name="apartment" size={16} /> {a.doctor.clinicName}</span>
        )}
        {a.reason && (
          <span className="icon"><Icon name="medical_services" size={16} /> {a.reason}</span>
        )}
      </div>
      <div className="appt-card-actions">
        {a.doctor?.location?.coordinates?.length === 2 && (
          <a
            className="btn-secondary icon"
            href={`https://www.google.com/maps/dir/?api=1&destination=${a.doctor.location.coordinates[1]},${a.doctor.location.coordinates[0]}`}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "none", color: "var(--primary)" }}
          >
            <Icon name="directions" size={18} /> Directions
          </a>
        )}
        <AppointmentActions appointment={a} onChanged={loadUpcoming} />
      </div>
    </div>
    );
  };

  // Older servers send a single `doctor` / `pending`.
  const doctors = assoc?.doctors || (assoc?.doctor ? [{ ...assoc.doctor, myReview: assoc.myReview }] : []);
  const pendings = assoc?.pendings || (assoc?.pending ? [assoc.pending] : []);

  return (
    <div className="page">
      <h1 className="icon"><Icon name="waving_hand" /> Hello, {user.name}</h1>

      {assocNotice && (
        <div className="card" style={{ maxWidth: "none", borderColor: "var(--primary)" }}>
          <p className="icon" style={{ margin: 0 }}>
            <Icon name="check_circle" size={18} /> {assocNotice}
          </p>
        </div>
      )}

      {/* 1 — Scheduled appointment */}
      <section>
        <h2 className="icon" style={{ marginBottom: 8 }}>
          <Icon name="event_upcoming" /> Scheduled appointment{upcoming.length > 1 ? "s" : ""}
        </h2>
        {upcoming.length > 0 ? (
          <div className="appt-list">{upcoming.map(renderAppointment)}</div>
        ) : (
          <div className="card" style={{ maxWidth: "none" }}>
            <p className="icon muted" style={{ margin: 0 }}>
              <Icon name="event_busy" size={18} /> No scheduled appointments right now.
            </p>
          </div>
        )}
      </section>

      {/* 2 — Payments / outstanding balance */}
      <section>
        <h2 className="icon" style={{ marginBottom: 8 }}>
          <Icon name="payments" /> Payments
        </h2>
        {outstanding > 0 ? (
          <div className="card balance-due" style={{ maxWidth: "none" }}>
            <div
              className="row gap"
              style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}
            >
              <div>
                <div className="icon" style={{ fontWeight: 700, color: "var(--heading)" }}>
                  <Icon name="account_balance_wallet" size={18} /> Outstanding balance
                </div>
                <div className="balance-amount">{money(outstanding)}</div>
                <div className="muted" style={{ fontSize: 13 }}>Please clear it at your next visit.</div>
              </div>
              <Link
                to="/client/treatments"
                className="btn-secondary icon"
                style={{ textDecoration: "none", borderColor: "var(--primary)", color: "var(--primary)" }}
              >
                <Icon name="receipt_long" size={18} /> View details
              </Link>
            </div>
          </div>
        ) : (
          <div className="card" style={{ maxWidth: "none" }}>
            <p className="icon" style={{ margin: 0, color: "#1a7f37" }}>
              <Icon name="check_circle" size={18} /> You're all paid up.
            </p>
          </div>
        )}
      </section>

      {/* 3 — My doctors (a patient may see several: dentist, physio, eye…) */}
      <section>
        <h2 className="icon" style={{ marginBottom: 8 }}>
          <Icon name="medical_information" /> My doctor{doctors.length > 1 ? "s" : ""}
        </h2>
        {assoc === null ? (
          <div className="card" style={{ maxWidth: "none" }}>
            <p className="muted" style={{ margin: 0 }}>Loading…</p>
          </div>
        ) : (
          <>
            {doctors.map((d) => (
              <DoctorCard
                key={d._id}
                doctor={d}
                onOpen={() => navigate(`/doctors/${d._id}`)}
                onLeave={() => {
                  setLeaveRating(d.myReview?.rating || 5);
                  setLeaveComment("");
                  setLeaveDoctor(d);
                }}
                onReviewed={loadAssoc}
              />
            ))}
            {pendings.map((p) => (
              <div key={p._id} className="card" style={{ maxWidth: "none" }}>
                <p className="muted" style={{ margin: 0 }}>
                  Request pending with Dr. {p.doctor?.name}. You'll be notified once they respond.
                </p>
              </div>
            ))}
            <div className="card" style={{ maxWidth: "none" }}>
              <div className="row gap" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <span className="muted">
                  {doctors.length
                    ? "Seeing another specialist? Add them here too."
                    : "You're not associated with a doctor yet."}
                </span>
                <Link to="/find-doctor" className="btn-secondary icon" style={{ textDecoration: "none" }}>
                  <Icon name="person_search" size={18} /> {doctors.length ? "Add another doctor" : "Find a doctor"}
                </Link>
              </div>
            </div>
          </>
        )}
      </section>

      {leaveDoctor && (
        <div className="modal-backdrop" onClick={() => setLeaveDoctor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Leave Dr. {leaveDoctor.name}?</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Your other doctors aren't affected. Please rate your experience before you go.
            </p>
            <StarRating value={leaveRating} onChange={setLeaveRating} size={28} />
            <textarea
              rows={3}
              placeholder="Optional review…"
              value={leaveComment}
              onChange={(e) => setLeaveComment(e.target.value)}
            />
            <div className="row gap">
              <button className="btn-danger" onClick={disassociate} disabled={leaving}>
                {leaving ? "Leaving…" : "Confirm & leave"}
              </button>
              <button className="btn-secondary" onClick={() => setLeaveDoctor(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// One of the patient's doctors: who they are, whether the clinic is open, the
// patient's review of them, and a way to leave just this doctor.
function DoctorCard({ doctor, onOpen, onLeave, onReviewed }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const review = doctor.myReview;
  const st = clinicStatus(doctor.availability);

  const submit = async () => {
    setError("");
    setSubmitting(true);
    try {
      await api.post(`/doctors/${doctor._id}/reviews`, { rating, comment });
      setEditing(false);
      onReviewed(); // refresh myReview + the doctor's average
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit your review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: "none" }}>
      <div
        onClick={onOpen}
        title="View doctor details"
        style={{ display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}
      >
        <Avatar src={doctor.image} name={doctor.name} size={56} />
        <div>
          <strong>Dr. {doctor.name}</strong>
          {(doctor.specialization || doctor.clinicName) && (
            <div className="muted" style={{ fontSize: 13 }}>
              {[doctor.specialization, doctor.clinicName].filter(Boolean).join(" · ")}
            </div>
          )}
          {st && (
            <span className={`clinic-badge ${st.kind}`} style={{ marginTop: 4 }}>
              <Icon name={st.icon} size={14} /> {st.text}
            </span>
          )}
        </div>
      </div>

      <hr className="divider" />

      {review && !editing ? (
        <>
          <p className="icon" style={{ margin: 0, color: "#1a7f37" }}>
            <Icon name="check_circle" size={18} /> Thanks — you've reviewed this doctor.
          </p>
          <div className="row gap" style={{ alignItems: "center", marginTop: 6 }}>
            <StarRating value={review.rating} size={20} />
            <span className="muted" style={{ fontSize: 13 }}>Your rating</span>
          </div>
          {review.comment && (
            <p style={{ margin: "2px 0 0", fontStyle: "italic", color: "var(--text)" }}>
              "{review.comment}"
            </p>
          )}
          <div className="row gap" style={{ flexWrap: "wrap", marginTop: 4 }}>
            <button
              className="btn-secondary icon"
              onClick={() => {
                setRating(review.rating);
                setComment(review.comment || "");
                setError("");
                setEditing(true);
              }}
            >
              <Icon name="edit" size={18} /> Edit review
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            {review ? "Update your review" : "How was your experience?"}
          </p>
          {error && <div className="error">{error}</div>}
          <StarRating value={rating} onChange={setRating} size={30} />
          <textarea
            rows={3}
            placeholder="Share your experience (optional)…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="row gap" style={{ flexWrap: "wrap" }}>
            <button className="icon" onClick={submit} disabled={submitting}>
              <Icon name="send" size={18} />{" "}
              {submitting ? "Submitting…" : review ? "Update review" : "Submit review"}
            </button>
            {review && (
              <button className="btn-secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
        </>
      )}

      <hr className="divider" />
      <div className="row gap" style={{ flexWrap: "wrap" }}>
        <Link to={`/doctors/${doctor._id}`} className="btn-secondary icon" style={{ textDecoration: "none" }}>
          <Icon name="info" size={18} /> View details
        </Link>
        <button className="btn-secondary icon" onClick={onLeave}>
          <Icon name="logout" size={18} /> Leave this doctor
        </button>
      </div>
    </div>
  );
}
