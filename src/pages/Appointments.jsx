import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api/axios";
import { formatDateTime, formatTime } from "../utils/date";
import { useNotifications } from "../context/NotificationsContext";
import Icon from "../components/Icon";
import SlotPicker from "../components/SlotPicker";
import ClientSearchSelect from "../components/ClientSearchSelect";
import { trackAppointment } from "../utils/analytics";

const empty = { client: "", date: "", reason: "", notes: "", status: "scheduled" };
const statusLabel = (s) => (s === "no_show" ? "No-show" : s === "pending" ? "Pending" : s);

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [scheduled, setScheduled] = useState(null); // { shareMessage, whatsappUrl } after creating
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date-asc");
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("upcoming"); // upcoming | past
  const [createDay, setCreateDay] = useState(""); // pre-selected day when "Add" tapped on a day header
  const [saving, setSaving] = useState(false); // in-flight lock so a double-click can't create two
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { items, refresh: refreshNotifications } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const load = async () => {
    const [a, c] = await Promise.all([
      api.get("/appointments"),
      api.get("/clients"),
    ]);
    setAppointments(a.data);
    setClients(c.data);
    setLoadError(false);
  };
  const loadAppointments = () =>
    api
      .get("/appointments")
      .then((r) => { setAppointments(r.data); setLoadError(false); })
      .catch(() => {});

  // Manual refresh — spins the button; keeps existing data visible.
  const refresh = () => {
    setRefreshing(true);
    load()
      .catch((e) => { console.error(e); setLoadError(true); })
      .finally(() => setRefreshing(false));
  };

  useEffect(() => {
    load().catch((e) => { console.error(e); setLoadError(true); });
  }, []);

  // Reflect reschedules made by clients: refetch when a notification arrives or the tab regains focus
  useEffect(() => {
    loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  useEffect(() => {
    const onFocus = () => loadAppointments();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  // Poll periodically so the doctor and assistant see each other's changes
  // (e.g. a slot booked moments ago) without needing a manual refresh.
  useEffect(() => {
    const id = setInterval(loadAppointments, 25000);
    return () => clearInterval(id);
  }, []);

  // Reset sort to appropriate default when switching tabs
  useEffect(() => {
    if (tab === "past") {
      setSortBy("date-desc");
    } else {
      setSortBy("date-asc");
    }
  }, [tab]);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const resetForm = () => {
    setForm(empty);
    setEditingId(null);
    setError("");
    setShowForm(false);
  };

  const openCreate = (day = "") => {
    setForm(empty);
    setEditingId(null);
    setError("");
    setCreateDay(day);
    setShowForm(true);
  };

  // Open the create form with an exact slot pre-selected (day + time), e.g. when
  // an available slot is tapped on the doctor's Today's schedule.
  const openCreateAt = (iso) => {
    const day = iso ? iso.slice(0, 10) : "";
    setForm({ ...empty, date: iso });
    setEditingId(null);
    setError("");
    setCreateDay(day);
    setShowForm(true);
  };

  // Consume a slot passed from another page (Today's schedule → "Add") once,
  // then clear it so a refresh or back-nav doesn't reopen the form.
  useEffect(() => {
    const at = location.state?.prefillAt;
    if (at) {
      openCreateAt(at);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (saving) return; // ignore a second click while the first is still saving
    if (!form.client) return setError("Please select a patient.");
    if (!form.date) return setError("Please pick a time slot.");
    // Enforce "not in the past" only when CREATING. When editing an existing
    // appointment the slot picker already disables past slots, and staff must be
    // able to update a passed appointment (e.g. mark it completed / no-show), so
    // we never block the edit on its (past) date.
    if (!editingId && new Date(form.date).getTime() < Date.now())
      return setError("Appointment cannot be in the past.");
    setSaving(true);
    try {
      // form.date is already an ISO instant from the slot picker
      const payload = { ...form };
      if (editingId) {
        await api.put(`/appointments/${editingId}`, payload);
        trackAppointment("updated", { appointment_id: editingId, actor: "doctor" });
        resetForm();
      } else {
        const { data } = await api.post("/appointments", payload);
        trackAppointment("booked", { appointment_id: data?.appointment?._id, actor: "doctor" });
        resetForm();
        setScheduled(data);
      }
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Save failed");
      // On a conflict (slot taken or record changed by someone else), pull the
      // latest so the doctor/assistant sees the current state before retrying.
      if (err.response?.status === 409) loadAppointments();
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (a) => {
    setEditingId(a._id);
    setShowForm(true);
    setForm({
      client: a.client?._id || "",
      date: a.date, // ISO; SlotPicker derives day + slot from it
      reason: a.reason || "",
      notes: a.notes || "",
      status: a.status,
      version: a.__v, // for optimistic-concurrency checks on save
    });
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this appointment?")) return;
    await api.delete(`/appointments/${id}`);
    trackAppointment("deleted", { appointment_id: id, actor: "doctor" });
    load();
  };

  const respondToRequest = async (id, action) => {
    try {
      await api.patch(`/appointments/${id}/${action}`);
      trackAppointment(action === "confirm" ? "confirmed" : "declined", {
        appointment_id: id,
        actor: "doctor",
      });
      await loadAppointments();
      refreshNotifications();
    } catch (err) {
      alert(err.response?.data?.message || "Could not update the request.");
      loadAppointments();
    }
  };

  // Defensive: collapse accidental duplicate records — the same patient at the
  // exact same slot with the same status — that a rare double-submit/race can
  // create, so staff never see two identical cards. (Keep the earliest-created.)
  const seenKeys = new Set();
  const uniqueAppointments = [...appointments]
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    .filter((a) => {
      const key = `${a.client?._id || a.client}|${a.date}|${a.status}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

  const pendingRequests = uniqueAppointments.filter((a) => a.status === "pending");

  // Filter by client name/email, then sort by the chosen key.
  // Pending requests are shown in their own panel, not the main table.
  const visible = uniqueAppointments
    .filter((a) => a.status !== "pending")
    .filter((a) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        a.client?.name?.toLowerCase().includes(q) ||
        a.client?.email?.toLowerCase().includes(q) ||
        a.client?.phone?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return new Date(b.date) - new Date(a.date);
        case "created-desc":
          return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date);
        case "name":
          return (a.client?.name || "").localeCompare(b.client?.name || "");
        case "status":
          return (a.status || "").localeCompare(b.status || "");
        case "date-asc":
        default:
          return new Date(a.date) - new Date(b.date);
      }
    });

  // Split into upcoming vs past (by appointment time), keeping the chosen sort.
  const now = Date.now();
  const upcoming = visible.filter((a) => new Date(a.date).getTime() >= now);
  const past = visible.filter((a) => new Date(a.date).getTime() < now);

  const renderCard = (a) => (
    <div
      key={a._id}
      className="appt-card"
      style={{ cursor: "pointer" }}
      onClick={() => setSelected(a)}
      title="View details"
    >
      <div className="appt-card-head">
        <span className="appt-when icon">
          <Icon name="schedule" size={18} /> {formatDateTime(a.date)}
        </span>
        <div className="row gap" style={{ flexWrap: "wrap" }}>
          <span className={`st st-${a.status}`}>{statusLabel(a.status)}</span>
          {a.arrivalStatus && a.arrivalStatus !== "none" && (
            <span className={`clinic-badge ${a.arrivalStatus === "arrived" ? "open" : "soon"}`}>
              <Icon name={a.arrivalStatus === "arrived" ? "where_to_vote" : "directions_car"} size={14} />
              {a.arrivalStatus === "arrived" ? "Arrived" : "On the way"}
            </span>
          )}
        </div>
      </div>
      <div className="appt-card-body">
        <span className="icon"><Icon name="person" size={16} /> {a.client?.name}</span>
        {a.client?.phone && (
          <span className="icon"><Icon name="call" size={16} /> {a.client.phone}</span>
        )}
        {a.reason && (
          <span className="icon"><Icon name="medical_services" size={16} /> {a.reason}</span>
        )}
      </div>
      <div className="row gap" style={{ flexWrap: "wrap" }}>
        <button className="btn-secondary icon" onClick={(e) => { e.stopPropagation(); handleEdit(a); }}>
          <Icon name="edit" size={18} /> Edit
        </button>
        <button className="btn-danger-soft icon" onClick={(e) => { e.stopPropagation(); handleDelete(a._id); }}>
          <Icon name="delete" size={18} /> Delete
        </button>
      </div>
    </div>
  );

  const dayHeading = (d) =>
    new Date(d).toLocaleDateString([], { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  // Local YYYY-MM-DD for the SlotPicker's date input (avoids UTC off-by-one).
  const toDayInput = (d) => {
    const x = new Date(d);
    const p = (n) => String(n).padStart(2, "0");
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
  };

  // Home-page style: group a (pre-sorted) list by day and show compact slot rows.
  const renderSchedule = (list, canAdd = false) => {
    const groups = [];
    let cur = null;
    for (const a of list) {
      const key = new Date(a.date).toDateString();
      if (!cur || cur.key !== key) {
        cur = { key, date: a.date, items: [] };
        groups.push(cur);
      }
      cur.items.push(a);
    }
    return groups.map((g) => (
      <div className="day-group" key={g.key}>
        <div className="day-head-row">
          <h3 className="day-heading icon"><Icon name="event" size={16} /> {dayHeading(g.date)}</h3>
          {canAdd && (
            <button
              type="button"
              className="btn-secondary icon day-add"
              onClick={() => openCreate(toDayInput(g.date))}
              title="Add an appointment on this day"
            >
              <Icon name="add" size={16} /> Add
            </button>
          )}
        </div>
        <div className="day-grid">
          {g.items.map((a) => (
            <div
              key={a._id}
              className="day-slot booked"
              onClick={() => setSelected(a)}
              title="View details"
            >
              <span className="slot-time">{formatTime(a.date)}</span>
              <span className="slot-patient">{a.client?.name || "—"}</span>
              <div className="row gap" style={{ flexWrap: "wrap" }}>
                <span className={`st st-${a.status}`}>{statusLabel(a.status)}</span>
                {a.arrivalStatus && a.arrivalStatus !== "none" && (
                  <span className={`clinic-badge ${a.arrivalStatus === "arrived" ? "open" : "soon"}`}>
                    <Icon name={a.arrivalStatus === "arrived" ? "where_to_vote" : "directions_car"} size={14} />
                    {a.arrivalStatus === "arrived" ? "Arrived" : "On the way"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    ));
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="icon"><Icon name="calendar_month" /> Appointments</h1>
        <div className="row gap" style={{ alignItems: "center" }}>
          <button
            type="button"
            className="slot-refresh"
            onClick={refresh}
            disabled={refreshing}
            title="Refresh appointments"
          >
            <Icon name="refresh" size={16} className={refreshing ? "spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          {!showForm && (
            <button className="icon" onClick={() => openCreate()}>
              <Icon name="event" size={18} /> Schedule appointment
            </button>
          )}
        </div>
      </div>

      {pendingRequests.length > 0 && (
        <div className="card" style={{ maxWidth: "none" }}>
          <h3 className="icon">
            <Icon name="pending_actions" size={18} /> Appointment requests ({pendingRequests.length})
          </h3>
          {pendingRequests
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map((a) => (
              <div
                key={a._id}
                className="row gap"
                style={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--border)" }}
              >
                <div>
                  <strong>{a.client?.name}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {formatDateTime(a.date)}{a.reason ? ` · ${a.reason}` : ""}
                  </div>
                </div>
                <div className="row gap" style={{ flexWrap: "wrap" }}>
                  <button className="icon" onClick={() => respondToRequest(a._id, "confirm")}>
                    <Icon name="check_circle" size={18} /> Confirm
                  </button>
                  <button className="btn-danger-soft icon" onClick={() => respondToRequest(a._id, "decline")}>
                    <Icon name="cancel" size={18} /> Decline
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {scheduled && (
        <div className="card" style={{ maxWidth: "none", borderColor: "var(--primary)" }}>
          <h3 className="icon">
            <Icon name="event_available" size={18} /> Appointment scheduled
          </h3>
          <p className="muted" style={{ margin: 0 }}>
            The client has been notified in-app and by email. You can also send a WhatsApp reminder:
          </p>
          <div className="row gap" style={{ flexWrap: "wrap" }}>
            <a
              className="btn-whatsapp"
              href={scheduled.whatsappUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="chat" size={18} /> Share via WhatsApp
            </a>
            <button
              type="button"
              className="btn-secondary"
              style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
              onClick={() => setScheduled(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {showForm && (
      <div className="modal-backdrop" onClick={resetForm}>
        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} style={{ display: "contents" }}>
        <h3 className="icon">
          <Icon name={editingId ? "edit_calendar" : "event"} size={18} />
          {editingId ? "Edit appointment" : "Schedule appointment"}
        </h3>
        {error && <div className="error">{error}</div>}
        <div className="grid-2">
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            Client
            <ClientSearchSelect
              clients={clients}
              value={form.client}
              onChange={(id) => setForm((f) => ({ ...f, client: id }))}
              disabled={!!editingId}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <SlotPicker
              key={editingId || createDay || "new"}
              value={form.date}
              initialDay={createDay}
              excludeId={editingId}
              allowPast={!!editingId}
              onChange={(iso) => setForm((f) => ({ ...f, date: iso }))}
            />
          </div>
          <label>
            Purpose <span className="muted">(optional)</span>
            <input
              name="reason"
              value={form.reason}
              onChange={handleChange}
            />
          </label>
          {editingId && (
            <label>
              Status
              <select name="status" value={form.status} onChange={handleChange}>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No-show</option>
              </select>
            </label>
          )}
        </div>
        <div className="row gap">
          <button type="submit" className="icon" disabled={saving}>
            <Icon name={editingId ? "save" : "add"} size={18} />
            {saving ? "Saving…" : editingId ? "Update" : "Create"}
          </button>
          <button type="button" className="btn-secondary" onClick={resetForm}>
            Cancel
          </button>
        </div>
        </form>
        </div>
      </div>
      )}

      <div className="row gap" style={{ flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div className="search-row" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
          <input
            placeholder="Search by name, email, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="search-btn icon" aria-hidden="true">
            <Icon name="search" size={18} />
          </span>
        </div>
        <label className="sort-label">
          <Icon name="sort" size={18} />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="date-asc">Appointment date (ascending)</option>
            <option value="date-desc">Appointment date (descending)</option>
            <option value="created-desc">Latest added</option>
            <option value="name">Client name (A–Z)</option>
            <option value="status">Status</option>
          </select>
        </label>
      </div>

      {loadError && appointments.length === 0 ? (
        <div className="card fin-error">
          <Icon name="cloud_off" size={28} />
          <p style={{ margin: 0 }}>
            Couldn't load appointments — the connection may be slow. Nothing was lost; just try again.
          </p>
          <button type="button" className="icon" onClick={refresh} disabled={refreshing}>
            <Icon name="refresh" size={18} /> {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      ) : visible.length === 0 ? (
        <p className="muted">
          {search.trim() ? "No appointments match your search." : "No appointments scheduled."}
        </p>
      ) : (
        <>
          <div className="period-toggle" style={{ marginTop: 8 }}>
            <button
              type="button"
              className={`icon ${tab === "upcoming" ? "active" : ""}`}
              onClick={() => setTab("upcoming")}
            >
              <Icon name="event_upcoming" size={16} /> Upcoming ({upcoming.length})
            </button>
            <button
              type="button"
              className={`icon ${tab === "past" ? "active" : ""}`}
              onClick={() => setTab("past")}
            >
              <Icon name="history" size={16} /> Past ({past.length})
            </button>
          </div>

          {tab === "upcoming" ? (
            upcoming.length === 0 ? (
              <p className="muted">No upcoming appointments.</p>
            ) : (
              renderSchedule(upcoming, true)
            )
          ) : past.length === 0 ? (
            <p className="muted">No past appointments.</p>
          ) : (
            renderSchedule(past)
          )}
        </>
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
            </div>
            <div className="appt-detail-actions">
              {selected.client?._id && (
                <button className="icon" onClick={() => navigate(`/clients/${selected.client._id}`)}>
                  <Icon name="badge" size={18} /> Patient details
                </button>
              )}
              <button
                className="btn-secondary icon"
                onClick={() => { const a = selected; setSelected(null); handleEdit(a); }}
              >
                <Icon name="edit" size={18} /> Edit
              </button>
              <button
                className="btn-danger-soft icon"
                onClick={() => { const id = selected._id; setSelected(null); handleDelete(id); }}
              >
                <Icon name="delete" size={18} /> Delete
              </button>
              <button type="button" className="btn-secondary icon" onClick={() => setSelected(null)}>
                <Icon name="close" size={18} /> Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
