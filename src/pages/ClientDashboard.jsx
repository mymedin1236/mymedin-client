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
// outstanding balance, (3) review your dentist.
export default function ClientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assoc, setAssoc] = useState(null); // { dentist, pending }
  const [upcoming, setUpcoming] = useState([]);
  const [outstanding, setOutstanding] = useState(0);
  const [showLeave, setShowLeave] = useState(false);
  const [leaveRating, setLeaveRating] = useState(5);
  const [leaveComment, setLeaveComment] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [assocNotice, setAssocNotice] = useState("");
  // Inline "review your dentist"
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [editingReview, setEditingReview] = useState(false); // showing the review form
  const [reviewError, setReviewError] = useState("");

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
        // patient + dentist + slot so the same appointment never shows twice.
        const seen = new Set();
        const deduped = list.filter((a) => {
          const key = `${a.client?._id || a.client}|${a.dentist?._id || a.dentist}|${a.date}`;
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
      .post("/associations/request", { dentistId: pend.id })
      .then(() => {
        setAssocNotice(
          `Request sent to Dr. ${pend.name || "your selected dentist"} — you'll be notified once they confirm.`
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
        rating: leaveRating,
        comment: leaveComment,
      });
      setShowLeave(false);
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

  const submitReview = async () => {
    if (!assoc?.dentist?._id) return;
    setReviewError("");
    setReviewSubmitting(true);
    try {
      await api.post(`/dentists/${assoc.dentist._id}/reviews`, {
        rating: reviewRating,
        comment: reviewComment,
      });
      setEditingReview(false);
      loadAssoc(); // refresh myReview + the dentist's average
    } catch (err) {
      setReviewError(err.response?.data?.message || "Could not submit your review.");
    } finally {
      setReviewSubmitting(false);
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
        <span className="icon"><Icon name="person" size={16} /> Dr. {a.dentist?.name}</span>
        {a.dentist?.clinicName && (
          <span className="icon"><Icon name="apartment" size={16} /> {a.dentist.clinicName}</span>
        )}
        {a.reason && (
          <span className="icon"><Icon name="medical_services" size={16} /> {a.reason}</span>
        )}
      </div>
      <div className="appt-card-actions">
        {a.dentist?.location?.coordinates?.length === 2 && (
          <a
            className="btn-secondary icon"
            href={`https://www.google.com/maps/dir/?api=1&destination=${a.dentist.location.coordinates[1]},${a.dentist.location.coordinates[0]}`}
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

      {/* 3 — Review your dentist */}
      <section>
        <h2 className="icon" style={{ marginBottom: 8 }}>
          <Icon name="reviews" /> Review your dentist
        </h2>
        <div className="card" style={{ maxWidth: "none" }}>
          {assoc === null ? (
            <p className="muted" style={{ margin: 0 }}>Loading…</p>
          ) : assoc.dentist ? (
            <>
              <div
                onClick={() => navigate(`/dentists/${assoc.dentist._id}`)}
                title="View dentist details"
                style={{ display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}
              >
                <Avatar src={assoc.dentist.image} name={assoc.dentist.name} size={56} />
                <div>
                  <strong>Dr. {assoc.dentist.name}</strong>
                  {assoc.dentist.clinicName && (
                    <div className="muted" style={{ fontSize: 13 }}>{assoc.dentist.clinicName}</div>
                  )}
                  {(() => {
                    const st = clinicStatus(assoc.dentist.availability);
                    return st ? (
                      <span className={`clinic-badge ${st.kind}`} style={{ marginTop: 4 }}>
                        <Icon name={st.icon} size={14} /> {st.text}
                      </span>
                    ) : null;
                  })()}
                </div>
              </div>

              <hr className="divider" />

              {assoc.myReview && !editingReview ? (
                <>
                  <p className="icon" style={{ margin: 0, color: "#1a7f37" }}>
                    <Icon name="check_circle" size={18} /> Thanks — you've reviewed this dentist.
                  </p>
                  <div className="row gap" style={{ alignItems: "center", marginTop: 6 }}>
                    <StarRating value={assoc.myReview.rating} size={20} />
                    <span className="muted" style={{ fontSize: 13 }}>Your rating</span>
                  </div>
                  {assoc.myReview.comment && (
                    <p style={{ margin: "2px 0 0", fontStyle: "italic", color: "var(--text)" }}>
                      "{assoc.myReview.comment}"
                    </p>
                  )}
                  <div className="row gap" style={{ flexWrap: "wrap", marginTop: 4 }}>
                    <button
                      className="btn-secondary icon"
                      onClick={() => {
                        setReviewRating(assoc.myReview.rating);
                        setReviewComment(assoc.myReview.comment || "");
                        setReviewError("");
                        setEditingReview(true);
                      }}
                    >
                      <Icon name="edit" size={18} /> Edit review
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="muted" style={{ marginTop: 0 }}>
                    {assoc.myReview ? "Update your review" : "How was your experience?"}
                  </p>
                  {reviewError && <div className="error">{reviewError}</div>}
                  <StarRating value={reviewRating} onChange={setReviewRating} size={30} />
                  <textarea
                    rows={3}
                    placeholder="Share your experience (optional)…"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                  />
                  <div className="row gap" style={{ flexWrap: "wrap" }}>
                    <button className="icon" onClick={submitReview} disabled={reviewSubmitting}>
                      <Icon name="send" size={18} />{" "}
                      {reviewSubmitting ? "Submitting…" : assoc.myReview ? "Update review" : "Submit review"}
                    </button>
                    {assoc.myReview && (
                      <button className="btn-secondary" onClick={() => setEditingReview(false)}>
                        Cancel
                      </button>
                    )}
                  </div>
                </>
              )}

              <hr className="divider" />
              <div className="row gap" style={{ flexWrap: "wrap" }}>
                <Link
                  to={`/dentists/${assoc.dentist._id}`}
                  className="btn-secondary icon"
                  style={{ textDecoration: "none" }}
                >
                  <Icon name="info" size={18} /> View details
                </Link>
                <button className="btn-secondary icon" onClick={() => setShowLeave(true)}>
                  <Icon name="logout" size={18} /> Leave / switch dentist
                </button>
              </div>
            </>
          ) : assoc.pending ? (
            <p className="muted" style={{ margin: 0 }}>
              Request pending with Dr. {assoc.pending.dentist?.name}. You'll be notified once they respond.
            </p>
          ) : (
            <div className="row gap" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <span className="muted">You're not associated with a dentist yet.</span>
              <Link to="/find-dentist" className="btn-secondary icon" style={{ textDecoration: "none" }}>
                <Icon name="person_search" size={18} /> Find a dentist
              </Link>
            </div>
          )}
        </div>
      </section>

      {showLeave && (
        <div className="modal-backdrop" onClick={() => setShowLeave(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Leave Dr. {assoc?.dentist?.name}?</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Please rate your experience before you go.
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
              <button className="btn-secondary" onClick={() => setShowLeave(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
