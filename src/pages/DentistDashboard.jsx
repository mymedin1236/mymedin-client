import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { formatDate, formatDateTime } from "../utils/date";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationsContext";
import Icon from "../components/Icon";
import { SkeletonTable } from "../components/Skeleton";
import SlotPicker from "../components/SlotPicker";
import { trackAppointment } from "../utils/analytics";
import {
  clinicDayStr,
  clinicHM,
  clinicToday,
  clinicDow,
  clinicToInstant,
} from "../utils/clinicTime";

const pad = (n) => String(n).padStart(2, "0");
// Today's Schedule is computed in the clinic's timezone (see utils/clinicTime),
// so the board is identical on every device regardless of its timezone setting.
const dayStr = (d) => clinicDayStr(d);
const hm = (d) => clinicHM(d);
const JS_DAY_TO_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const fmt12 = (s) => {
  const [h, m] = s.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
};
const toMin = (s) => {
  const [h, m] = String(s).split(":").map(Number);
  return h * 60 + (m || 0);
};
const buildSlots = (startMin, endMin, step) => {
  const out = [];
  for (let t = startMin; t < endMin; t += step) out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  return out;
};
const statusLabel = (s) => (s === "no_show" ? "No-show" : s);
const money = (n) => `Rs ${(Number(n) || 0).toLocaleString("en-US")}`;

// Waiting time since the patient was marked "arrived".
const waitMins = (arrivedAt, now) =>
  Math.max(0, Math.floor((now - new Date(arrivedAt).getTime()) / 60000));
const fmtWait = (arrivedAt, now) => {
  const m = waitMins(arrivedAt, now);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
};
// Escalate the counter's colour the longer someone has been waiting.
const waitLevel = (arrivedAt, now) => {
  const m = waitMins(arrivedAt, now);
  if (m >= 30) return " wait-high";
  if (m >= 15) return " wait-mid";
  return "";
};

const STATUS_ACTIONS = [
  { value: "completed", label: "Mark done", icon: "task_alt" },
  { value: "cancelled", label: "Cancel", icon: "cancel" },
  { value: "no_show", label: "No-show", icon: "person_off" },
  { value: "scheduled", label: "Reopen", icon: "event_repeat" },
];

export default function DentistDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appts, setAppts] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [balances, setBalances] = useState({}); // { clientId: outstanding }
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reschedOpen, setReschedOpen] = useState(false); // reschedule panel in the modal
  const [reschedDate, setReschedDate] = useState(null); // chosen new slot (ISO)
  const [dismissEnroll, setDismissEnroll] = useState(false); // hide discovery reminder
  const [step, setStep] = useState(15); // clinic's slot length (minutes)
  // Ticks every 30s so the waiting-time counters advance without a data refetch.
  const [nowTick, setNowTick] = useState(() => Date.now());

  const { items } = useNotifications();
  const [today, setToday] = useState(() => dayStr(new Date()));

  const load = useCallback(async () => {
    // Recompute the current day on every load so an open dashboard rolls over to
    // the new day (via refresh or the poll) without needing a full page reload.
    const day = clinicToday();
    setToday(day);
    const from = clinicToInstant(day, 0);
    const to = clinicToInstant(day, 24 * 60);
    const [all, booked, outstanding] = await Promise.all([
      api.get("/appointments", { skipLoader: true }),
      api.get("/appointments/booked", {
        params: { from: from.toISOString(), to: to.toISOString() },
        skipLoader: true,
      }),
      api.get("/treatments/outstanding", { skipLoader: true }).catch(() => ({ data: {} })),
    ]);
    setAppts(all.data);
    setAvailability(booked.data.availability || []);
    setStep(booked.data.slotDuration || 15);
    setBalances(outstanding.data || {});
    setLoadError(false); // any successful load (incl. background) clears the error
  }, []);

  // Manual refresh — shows the loading skeleton (like a page reload) so the
  // dentist clearly sees it refresh, then swaps in the fresh data.
  const refresh = () => {
    setLoading(true);
    load()
      .catch((e) => { console.error(e); setLoadError(true); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load()
      .catch((e) => { console.error(e); setLoadError(true); })
      .finally(() => setLoading(false));
  }, [load]);

  // Refresh when the tab regains focus (assistant/dentist may have changed things)
  useEffect(() => {
    const onFocus = () => load().catch(() => {});
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  // Live updates: refetch when a notification arrives (e.g. a patient marks
  // "on the way" / "arrived"), and poll every 15s as a fallback so the board
  // stays current even while the dentist is watching it.
  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  useEffect(() => {
    const id = setInterval(() => load().catch(() => {}), 9000);
    return () => clearInterval(id);
  }, [load]);

  // Advance the waiting-time counters live (independent of data refetches).
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Today's appointments, keyed by their slot start time (HH:mm)
  const apptByTime = useMemo(() => {
    const map = {};
    for (const a of appts) {
      const d = new Date(a.date);
      if (dayStr(d) !== today) continue;
      if (a.status === "cancelled") continue; // a cancelled slot is free again
      map[hm(d)] = a; // last write wins; appointments are unique per slot
    }
    return map;
  }, [appts, today]);

  // Clinic hours for today, as one or more windows (morning + evening supported).
  const windows = useMemo(() => {
    const label = JS_DAY_TO_LABEL[clinicDow(today)];
    const entries = availability.filter((a) => a.day === label && a.start && a.end);
    if (entries.length) return entries.map((a) => ({ start: toMin(a.start), end: toMin(a.end) }));
    if (availability.length === 0) return [{ start: 9 * 60, end: 18 * 60 }];
    return [];
  }, [availability, today]);

  const slots = useMemo(() => {
    const set = new Set();
    for (const w of windows) for (const s of buildSlots(w.start, w.end, step)) set.add(s);
    return [...set].sort((a, b) => toMin(a) - toMin(b));
  }, [windows, step]);

  // Times to render = the clinic-hours grid PLUS any appointment whose time
  // doesn't fall on the current grid (e.g. a 9:15 booking made under 15-min
  // slots, now that slots are 20-min). Merging them in — sorted by time — makes
  // sure NO existing appointment is ever hidden just because it's "off-grid".
  const rows = useMemo(() => {
    const set = new Set(slots);
    for (const t of Object.keys(apptByTime)) set.add(t);
    return [...set].sort((a, b) => toMin(a) - toMin(b));
  }, [slots, apptByTime]);

  const updateStatus = async (status) => {
    if (!selected) return;
    setBusy(true);
    try {
      const { data } = await api.put(`/appointments/${selected._id}`, {
        status,
        version: selected.__v,
      });
      trackAppointment("status_changed", {
        appointment_id: selected._id,
        status,
        actor: "dentist",
      });
      setSelected(data);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Could not update status.");
      if (err.response?.status === 409) {
        await load();
        setSelected(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const openReschedule = () => {
    setReschedDate(selected?.date || null);
    setReschedOpen(true);
  };

  // Staff move an appointment to a new slot (e.g. a clinic-wide disruption). Uses
  // the staff edit endpoint, which re-arms reminders and notifies the patient of
  // the new time.
  const submitReschedule = async () => {
    if (!selected || !reschedDate) return;
    if (new Date(reschedDate).getTime() === new Date(selected.date).getTime()) {
      setReschedOpen(false);
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.put(`/appointments/${selected._id}`, {
        date: reschedDate,
        status: "scheduled",
        version: selected.__v,
      });
      trackAppointment("rescheduled", { appointment_id: selected._id, actor: "dentist" });
      setSelected(data);
      setReschedOpen(false);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Could not reschedule.");
      if (err.response?.status === 409) {
        await load();
        setSelected(null);
        setReschedOpen(false);
      }
    } finally {
      setBusy(false);
    }
  };

  // Staff (dentist or assistant) can also mark a patient arrived — starts the
  // same waiting counter — or undo it. The patient can still do it themselves.
  const setArrival = async (status) => {
    if (!selected) return;
    setBusy(true);
    try {
      const { data } = await api.patch(`/appointments/${selected._id}/arrival`, { status });
      trackAppointment("arrival_updated", {
        appointment_id: selected._id,
        arrival_status: status,
        actor: "dentist",
      });
      setSelected(data);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Could not update arrival.");
    } finally {
      setBusy(false);
    }
  };

  const respondPending = async (action) => {
    if (!selected) return;
    setBusy(true);
    try {
      const { data } = await api.patch(`/appointments/${selected._id}/${action}`);
      trackAppointment(action === "confirm" ? "confirmed" : "declined", {
        appointment_id: selected._id,
        actor: "dentist",
      });
      setSelected(data);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Could not update the request.");
      await load();
      setSelected(null);
    } finally {
      setBusy(false);
    }
  };

  const greeting = `Welcome, ${user.role === "dentist" ? "Dr. " : ""}${user.name}`;

  // Gentle reminder when the free discovery period is ending or has just ended
  // (only the dentist's record carries the signed agreement).
  let enrollReminder = null;
  if (user.agreement?.acceptedAt && !dismissEnroll) {
    const de = new Date(user.agreement.acceptedAt);
    de.setMonth(de.getMonth() + 3);
    const daysLeft = Math.ceil((de.getTime() - Date.now()) / 86400000);
    if (daysLeft > 0 && daysLeft <= 7) enrollReminder = { kind: "ending", daysLeft };
    else if (daysLeft <= 0 && daysLeft > -14) enrollReminder = { kind: "ended" };
  }

  if (loading)
    return (
      <div className="page">
        <h1 className="icon dash-greeting"><Icon name="waving_hand" size={22} /> {greeting}</h1>
        <h2 className="icon dash-subhead"><Icon name="today" size={18} /> Today's schedule</h2>
        <SkeletonTable rows={4} cols={3} />
      </div>
    );

  const bookedCount = Object.keys(apptByTime).length;

  return (
    <div className="page">
      <h1 className="icon dash-greeting"><Icon name="waving_hand" size={22} /> {greeting}</h1>

      {enrollReminder && (
        <div className="enroll-reminder">
          <Icon name="schedule" size={18} />
          <span>
            {enrollReminder.kind === "ending"
              ? `Your free discovery period ends in ${enrollReminder.daysLeft} day${enrollReminder.daysLeft !== 1 ? "s" : ""} — Rs 3,000/month begins after that.`
              : "Your free discovery period has ended — the Rs 3,000/month subscription is now active."}
          </span>
          <button type="button" className="enroll-reminder-link" onClick={() => navigate("/agreement")}>
            View agreement
          </button>
          <button
            type="button"
            className="enroll-reminder-x"
            aria-label="Dismiss"
            onClick={() => setDismissEnroll(true)}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      <div className="row gap" style={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
        <h2 className="icon dash-subhead" style={{ margin: 0 }}><Icon name="today" size={18} /> Today's schedule</h2>
        <div className="row gap" style={{ alignItems: "center", gap: 12 }}>
          {!loadError && (
            <span className="muted">{formatDate(new Date())} · {bookedCount} booked</span>
          )}
          <button
            type="button"
            className="slot-refresh"
            onClick={refresh}
            title="Refresh today's schedule"
          >
            <Icon name="refresh" size={16} /> Refresh
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="card fin-error">
          <Icon name="cloud_off" size={28} />
          <p style={{ margin: 0 }}>
            Couldn't load today's schedule — the connection may be slow. Nothing was lost; just try again.
          </p>
          <button type="button" className="icon" onClick={refresh}>
            <Icon name="refresh" size={18} /> Refresh
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="muted">The clinic is closed today.</p>
      ) : (
        <div className="day-grid">
          {rows.map((slot) => {
            const appt = apptByTime[slot];
            if (!appt) {
              const slotIso = clinicToInstant(today, toMin(slot));
              const isPast = slotIso.getTime() < Date.now();
              // Past empty slots are just history; future ones can be booked.
              if (isPast) {
                return (
                  <div key={slot} className="day-slot available" title="Available">
                    <span className="slot-time">{fmt12(slot)}</span>
                    <span>Available</span>
                  </div>
                );
              }
              return (
                <button
                  key={slot}
                  type="button"
                  className="day-slot available addable"
                  title="Add an appointment at this time"
                  onClick={() =>
                    navigate("/appointments", { state: { prefillAt: slotIso.toISOString() } })
                  }
                >
                  <span className="slot-add-corner" aria-hidden="true"><Icon name="add" size={16} /></span>
                  <span className="slot-time">{fmt12(slot)}</span>
                  <span>Available</span>
                </button>
              );
            }
            return (
              <div
                key={slot}
                className="day-slot booked"
                onClick={() => {
                  setSelected(appt);
                  setReschedOpen(false);
                }}
                title="View details"
              >
                <span className="slot-time">{fmt12(slot)}</span>
                <span className="slot-patient">{appt.client?.name || "—"}</span>
                <div className="row gap" style={{ flexWrap: "wrap" }}>
                  <span className={`st st-${appt.status}`}>{statusLabel(appt.status)}</span>
                  {balances[appt.client?._id] > 0 && (
                    <span className="balance-badge" title="Outstanding balance">
                      <Icon name="account_balance_wallet" size={13} /> {money(balances[appt.client._id])}
                    </span>
                  )}
                  {appt.arrivalStatus && appt.arrivalStatus !== "none" && (
                    <span className={`clinic-badge ${appt.arrivalStatus === "arrived" ? "open" : "soon"}`}>
                      <Icon name={appt.arrivalStatus === "arrived" ? "where_to_vote" : "directions_car"} size={14} />
                      {appt.arrivalStatus === "arrived" ? "Arrived" : "On the way"}
                    </span>
                  )}
                  {appt.status === "scheduled" && appt.arrivalStatus === "arrived" && appt.arrivedAt && (
                    <span
                      className={`wait-badge${waitLevel(appt.arrivedAt, nowTick)}`}
                      title={`Waiting since ${formatDateTime(appt.arrivedAt)}`}
                    >
                      <Icon name="timer" size={13} /> {fmtWait(appt.arrivedAt, nowTick)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="icon"><Icon name="event" size={18} /> Appointment details</h3>
              <button type="button" className="modal-close" aria-label="Close" onClick={() => setSelected(null)}>
                <Icon name="close" />
              </button>
            </div>
            <div className="detail-list">
              <div className="detail-row">
                <Icon name="schedule" size={18} />
                <span>{formatDateTime(selected.date)}</span>
              </div>
              <div className="detail-row">
                <Icon name="person" size={18} />
                <span>{selected.client?.name || "—"}</span>
              </div>
              {balances[selected.client?._id] > 0 && (
                <div className="detail-row">
                  <Icon name="account_balance_wallet" size={18} />
                  <span style={{ color: "#b8791a", fontWeight: 700 }}>
                    Outstanding balance: {money(balances[selected.client._id])}
                  </span>
                </div>
              )}
              {selected.client?.phone && (
                <div className="detail-row">
                  <Icon name="call" size={18} />
                  <span>{selected.client.phone}</span>
                </div>
              )}
              {selected.client?.email && (
                <div className="detail-row">
                  <Icon name="mail" size={18} />
                  <span>{selected.client.email}</span>
                </div>
              )}
              <div className="detail-row">
                <Icon name="medical_services" size={18} />
                <span>{selected.reason || "No purpose given"}</span>
              </div>
              <div className="detail-row">
                <Icon name="info" size={18} />
                <span className={`st st-${selected.status}`}>{statusLabel(selected.status)}</span>
              </div>
              {selected.arrivalStatus && selected.arrivalStatus !== "none" && (
                <div className="detail-row">
                  <Icon name={selected.arrivalStatus === "arrived" ? "where_to_vote" : "directions_car"} size={18} />
                  <span className={`clinic-badge ${selected.arrivalStatus === "arrived" ? "open" : "soon"}`}>
                    {selected.arrivalStatus === "arrived" ? "Patient has arrived" : "Patient is on the way"}
                  </span>
                  {selected.status === "scheduled" && selected.arrivalStatus === "arrived" && selected.arrivedAt && (
                    <span className={`wait-badge${waitLevel(selected.arrivedAt, nowTick)}`}>
                      <Icon name="timer" size={14} /> Waiting {fmtWait(selected.arrivedAt, nowTick)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {selected.status === "pending" ? (
              <>
                <div className="lbl" style={{ marginTop: 4 }}>This is a patient request</div>
                <div className="row gap" style={{ flexWrap: "wrap" }}>
                  <button type="button" className="icon" disabled={busy} onClick={() => respondPending("confirm")}>
                    <Icon name="check_circle" size={18} /> Confirm
                  </button>
                  <button type="button" className="btn-danger-soft icon" disabled={busy} onClick={() => respondPending("decline")}>
                    <Icon name="cancel" size={18} /> Decline
                  </button>
                </div>
              </>
            ) : (
              <>
                {selected.status === "scheduled" && (
                  <>
                    <div className="lbl" style={{ marginTop: 4 }}>Arrival</div>
                    <div className="row gap" style={{ flexWrap: "wrap" }}>
                      {selected.arrivalStatus !== "arrived" ? (
                        <button type="button" className="icon" disabled={busy} onClick={() => setArrival("arrived")}>
                          <Icon name="where_to_vote" size={18} /> Mark arrived
                        </button>
                      ) : (
                        <button type="button" className="btn-secondary icon" disabled={busy} onClick={() => setArrival("none")}>
                          <Icon name="undo" size={18} /> Undo arrived
                        </button>
                      )}
                    </div>
                  </>
                )}
                <div className="lbl" style={{ marginTop: 4 }}>Update status</div>
                <div className="row gap" style={{ flexWrap: "wrap" }}>
                  {STATUS_ACTIONS.filter((a) => a.value !== selected.status).map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      className="btn-secondary icon"
                      disabled={busy}
                      onClick={() => updateStatus(a.value)}
                    >
                      <Icon name={a.icon} size={18} /> {a.label}
                    </button>
                  ))}
                </div>

                <div className="lbl" style={{ marginTop: 4 }}>Reschedule</div>
                {!reschedOpen ? (
                  <div className="row gap" style={{ flexWrap: "wrap" }}>
                    <button type="button" className="btn-secondary icon" disabled={busy} onClick={openReschedule}>
                      <Icon name="edit_calendar" size={18} /> Reschedule
                    </button>
                  </div>
                ) : (
                  <div className="resched-panel">
                    <SlotPicker
                      value={reschedDate}
                      excludeId={selected._id}
                      onChange={(iso) => setReschedDate(iso)}
                    />
                    <div className="row gap" style={{ marginTop: 8, flexWrap: "wrap" }}>
                      <button type="button" className="icon" disabled={busy || !reschedDate} onClick={submitReschedule}>
                        <Icon name="check_circle" size={18} /> Save new time
                      </button>
                      <button type="button" className="btn-secondary" disabled={busy} onClick={() => setReschedOpen(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="row gap" style={{ marginTop: 4 }}>
              {selected.client?._id && (
                <button className="icon" onClick={() => navigate(`/clients/${selected.client._id}`)}>
                  <Icon name="history" size={18} /> View patient record
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
