import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { formatDate, formatDateTime } from "../utils/date";
import { normalizePkPhone } from "../utils/phone";
import { shareViaSheet } from "../utils/share";
import Icon from "../components/Icon";
import PasswordInput from "../components/PasswordInput";
import { useNotifications } from "../context/NotificationsContext";

// Build a WhatsApp click-to-chat URL: local number -> international, message prefilled.
// Opens the dentist's own WhatsApp (app on phone / WhatsApp Web on desktop).
const waChatUrl = (phone, text) => {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "92" + d.slice(1);
  else if (!d.startsWith("92") && d.length <= 10) d = "92" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
};

// New patients get a default password the dentist can share; they change it later.
const DEFAULT_PASSWORD = "123456789";
const empty = {
  name: "",
  email: "",
  password: DEFAULT_PASSWORD,
  confirmPassword: DEFAULT_PASSWORD,
  phone: "",
  // Managed (child/dependent) patient — contact the guardian instead of the patient
  managed: false,
  dateOfBirth: "",
  guardianName: "",
  guardianPhone: "",
  guardianEmail: "",
};

// Capitalize the first letter of every word as the user types.
const titleCase = (s) => s.replace(/[0-9]/g, "").replace(/\b\p{L}/gu, (ch) => ch.toUpperCase());

export default function Clients({ mode = "patients" }) {
  const isDependents = mode === "dependents";
  const { items, refresh: refreshNotifications } = useNotifications();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null); // { client, credentials, shareMessage }
  const [copied, setCopied] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [menuFor, setMenuFor] = useState(null); // id of the card whose action menu is open
  const [balances, setBalances] = useState({}); // { clientId: outstanding }
  const [loading, setLoading] = useState(true); // first load of the patient list
  const [balancesLoaded, setBalancesLoaded] = useState(false); // outstanding filter needs balances
  // Keep the "Outstanding" filter in the URL so navigating into a patient and
  // pressing Back restores the filtered view instead of resetting to All.
  const [searchParams, setSearchParams] = useSearchParams();
  const onlyOutstanding = searchParams.get("filter") === "outstanding";
  const setOnlyOutstanding = (on) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (on) next.set("filter", "outstanding");
        else next.delete("filter");
        return next;
      },
      { replace: true }
    );
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Reset-password flow
  const [resetTarget, setResetTarget] = useState(null); // the patient being reset
  const [resetPwd, setResetPwd] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetResult, setResetResult] = useState(null); // { shareMessage } after reset
  const [resetCopied, setResetCopied] = useState(false);

  // WhatsApp message flow — opens the dentist's own WhatsApp (click-to-chat)
  const [msgTarget, setMsgTarget] = useState(null); // the patient being messaged
  const [msgText, setMsgText] = useState("");
  const [msgError, setMsgError] = useState("");

  const openMessage = (c) => {
    setMsgTarget(c);
    setMsgText("");
    setMsgError("");
  };

  const submitMessage = (e) => {
    e.preventDefault();
    setMsgError("");
    if (!msgText.trim()) return setMsgError("Type a message to send.");
    const phone = msgTarget.managed ? msgTarget.guardianPhone : msgTarget.phone;
    window.open(waChatUrl(phone, msgText.trim()), "_blank", "noopener");
    setMsgTarget(null);
  };

  const genTempPassword = () => `Dt${Math.random().toString(36).slice(2, 8)}9`;

  const openReset = (c) => {
    setResetTarget(c);
    setResetPwd(genTempPassword());
    setResetError("");
    setResetResult(null);
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setResetError("");
    if (resetPwd.length < 8) return setResetError("Password must be at least 8 characters.");
    setResetBusy(true);
    try {
      const { data } = await api.post(`/clients/${resetTarget._id}/reset-password`, { password: resetPwd });
      setResetResult({ ...data, name: resetTarget.name, phone: resetTarget.phone });
      setResetCopied(false);
      setResetTarget(null);
    } catch (err) {
      setResetError(err.response?.data?.message || "Could not reset password.");
    } finally {
      setResetBusy(false);
    }
  };

  const copyResetCreds = async () => {
    try {
      await navigator.clipboard.writeText(resetResult.shareMessage);
      setResetCopied(true);
    } catch {
      /* ignore */
    }
  };

  const resetWaLink = resetResult
    ? waChatUrl(resetResult.phone, resetResult.shareMessage)
    : "#";

  const load = async () => {
    try {
      const { data } = await api.get("/clients", {
        params: { search, managed: isDependents },
      });
      setClients(data);
      setLoadError(false);
    } catch (e) {
      console.error(e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh — reloads the list + balances; spins the button.
  const refresh = () => {
    setRefreshing(true);
    Promise.all([load(), loadBalances()]).finally(() => setRefreshing(false));
  };
  const loadRequests = async () => {
    if (isDependents) return; // dependents don't self-request association
    const { data } = await api.get("/associations/requests");
    setRequests(data);
  };
  // Per-patient outstanding balance for the clinic, to power the filter pill + badges.
  const loadBalances = () =>
    api
      .get("/treatments/outstanding", { skipLoader: true })
      .then((r) => setBalances(r.data || {}))
      .catch(() => {})
      .finally(() => setBalancesLoaded(true));

  useEffect(() => {
    loadRequests();
    loadBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live search by name / email / phone (debounced)
  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Refresh the pending-requests list + balances whenever notifications change
  // (e.g. a new request arrived, or a payment was recorded).
  useEffect(() => {
    loadRequests();
    loadBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const resetForm = () => {
    setForm({ ...empty, managed: isDependents });
    setEditingId(null);
    setError("");
    setShowForm(false);
  };

  const openCreate = () => {
    setForm({ ...empty, managed: isDependents });
    setEditingId(null);
    setError("");
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.managed) {
      if (!form.name.trim()) return setError("Patient name is required.");
      if (!form.guardianName.trim()) return setError("Guardian name is required.");
      if (!/^0\d{10}$/.test(form.guardianPhone))
        return setError("Guardian phone must be 11 digits and start with 0 (e.g. 03001234567).");
    } else {
      if (!/^0\d{10}$/.test(form.phone))
        return setError("Phone number must be 11 digits and start with 0 (e.g. 03001234567).");
      if (!editingId) {
        if (form.password.length < 8)
          return setError("Password must be at least 8 characters.");
        if (form.password !== form.confirmPassword)
          return setError("Passwords do not match.");
      }
    }
    try {
      if (editingId) {
        await api.put(`/clients/${editingId}`, form);
        resetForm();
      } else {
        const { data } = await api.post("/clients", form);
        setCreated(data);
        setCopied(false);
        resetForm();
      }
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Save failed");
    }
  };

  const handleEdit = (c) => {
    setEditingId(c._id);
    setShowForm(true);
    setForm({
      name: c.name || "",
      email: c.email || "",
      password: "",
      confirmPassword: "",
      phone: c.phone || "",
      managed: !!c.managed,
      dateOfBirth: c.dateOfBirth ? c.dateOfBirth.substring(0, 10) : "",
      guardianName: c.guardianName || "",
      guardianPhone: c.guardianPhone || "",
      guardianEmail: c.guardianEmail || "",
    });
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this patient?")) return;
    await api.delete(`/clients/${id}`);
    load();
  };

  const respond = async (id, action) => {
    await api.post(`/associations/${id}/${action}`);
    await loadRequests();
    await load();
    refreshNotifications();
  };

  const copyCreds = async () => {
    try {
      await navigator.clipboard.writeText(created.shareMessage);
      setCopied(true);
    } catch {
      /* ignore */
    }
  };

  const waLink = created
    ? waChatUrl(created.credentials?.phone, created.shareMessage)
    : "#";

  const money = (n) => `Rs ${(Number(n) || 0).toLocaleString("en-US")}`;
  const outstandingCount = clients.filter((c) => balances[c._id] > 0).length;
  const visibleClients = (
    onlyOutstanding ? clients.filter((c) => balances[c._id] > 0) : clients
  )
    .slice() // don't mutate the source list
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="icon">
          <Icon name={isDependents ? "escalator_warning" : "group"} />{" "}
          {isDependents ? "Dependents" : "Patients"}
          {clients.length > 0 && <span className="count-pill">{clients.length}</span>}
        </h1>
        <div className="row gap" style={{ alignItems: "center" }}>
          <button
            type="button"
            className="slot-refresh"
            onClick={refresh}
            disabled={refreshing}
            title={isDependents ? "Refresh dependents" : "Refresh patients"}
          >
            <Icon name="refresh" size={16} className={refreshing ? "spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        {!showForm && (
          <button className="icon" onClick={openCreate}>
            <Icon name="person_add" size={18} /> {isDependents ? "Add dependent" : "Add patient"}
          </button>
        )}
        </div>
      </div>

      {/* Pending association requests */}
      {requests.length > 0 && (
        <div className="card" style={{ maxWidth: "none" }}>
          <h3 className="icon">
            <Icon name="person_add" size={18} /> Association requests ({requests.length})
          </h3>
          {requests.map((r) => (
            <div
              key={r._id}
              className="row gap"
              style={{ justifyContent: "space-between", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 10 }}
            >
              <div>
                <strong>{r.client?.name}</strong>
                <div className="muted" style={{ fontSize: 13 }}>
                  {r.client?.email}
                  {r.client?.phone ? ` · ${r.client.phone}` : ""}
                </div>
              </div>
              <div className="row gap">
                <button className="icon" onClick={() => respond(r._id, "approve")}>
                  <Icon name="check" size={18} /> Approve
                </button>
                <button className="btn-secondary icon" onClick={() => respond(r._id, "reject")}>
                  <Icon name="close" size={18} /> Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Credentials sharing panel after creating a client */}
      {created && (
        <div className="card" style={{ maxWidth: "none", borderColor: "var(--primary)" }}>
          <h3 className="icon">
            <Icon name="check_circle" size={18} />{" "}
            {created.managed ? "Patient added" : "Account created"} for {created.client.name}
          </h3>
          <textarea readOnly rows={6} value={created.shareMessage} />
          <div className="row gap" style={{ flexWrap: "wrap" }}>
            {created.client?._id && (
              <button
                type="button"
                className="icon"
                onClick={() => { setCreated(null); navigate(`/clients/${created.client._id}`); }}
              >
                <Icon name="folder_open" size={18} /> Open {created.client.name}'s record
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={copyCreds}>
              <Icon name="content_copy" size={18} /> {copied ? "Copied!" : created.managed ? "Copy message" : "Copy credentials"}
            </button>
            <button
              type="button"
              className="btn-whatsapp"
              onClick={() => shareViaSheet({ text: created.shareMessage, fallbackUrl: waLink })}
            >
              <Icon name="chat" size={18} /> Share via WhatsApp
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
              onClick={() => setCreated(null)}
            >
              Dismiss
            </button>
          </div>
          {created.credentials.email && (
            <p className="muted" style={{ margin: 0 }}>
              {created.managed ? "Details were also emailed to " : "Credentials were also emailed to "}
              {created.credentials.email}.
            </p>
          )}
        </div>
      )}

      {resetResult && (
        <div className="card" style={{ maxWidth: "none", borderColor: "var(--primary)" }}>
          <h3 className="icon">
            <Icon name="lock_reset" size={18} /> Password reset for {resetResult.name}
          </h3>
          <textarea readOnly rows={6} value={resetResult.shareMessage} />
          <div className="row gap" style={{ flexWrap: "wrap" }}>
            <button type="button" className="icon" onClick={copyResetCreds}>
              <Icon name="content_copy" size={18} /> {resetCopied ? "Copied!" : "Copy credentials"}
            </button>
            <button
              type="button"
              className="btn-whatsapp"
              onClick={() => shareViaSheet({ text: resetResult.shareMessage, fallbackUrl: resetWaLink })}
            >
              <Icon name="chat" size={18} /> Share via WhatsApp
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
              onClick={() => setResetResult(null)}
            >
              Dismiss
            </button>
          </div>
          {resetResult.credentials?.email && (
            <p className="muted" style={{ margin: 0 }}>
              The new password was not emailed automatically — share it with the patient.
            </p>
          )}
        </div>
      )}

      {resetTarget && (
        <div className="modal-backdrop" onClick={() => setResetTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={submitReset} style={{ display: "contents" }}>
              <div className="modal-head">
                <h3 className="icon"><Icon name="lock_reset" size={18} /> Reset password</h3>
                <button type="button" className="modal-close" aria-label="Close" onClick={() => setResetTarget(null)}>
                  <Icon name="close" />
                </button>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                Set a new temporary password for <strong>{resetTarget.name}</strong>. Share it with them; they can change it after signing in.
              </p>
              {resetError && <div className="error">{resetError}</div>}
              <label>
                <span className="lbl">New password <span className="req">*</span></span>
                <div className="row gap">
                  <input
                    style={{ flex: 1 }}
                    value={resetPwd}
                    onChange={(e) => setResetPwd(e.target.value)}
                  />
                  <button type="button" className="btn-secondary icon" onClick={() => setResetPwd(genTempPassword())}>
                    <Icon name="autorenew" size={18} /> Generate
                  </button>
                </div>
              </label>
              <div className="row gap">
                <button type="submit" className="icon" disabled={resetBusy}>
                  <Icon name="lock_reset" size={18} /> {resetBusy ? "Resetting…" : "Reset password"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setResetTarget(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {msgTarget && (
        <div className="modal-backdrop" onClick={() => setMsgTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={submitMessage} style={{ display: "contents" }}>
              <div className="modal-head">
                <h3 className="icon"><Icon name="chat" size={18} /> WhatsApp message</h3>
                <button type="button" className="modal-close" aria-label="Close" onClick={() => setMsgTarget(null)}>
                  <Icon name="close" />
                </button>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                Type a message — it opens WhatsApp with <strong>{msgTarget.name}</strong>'s
                {msgTarget.managed ? " guardian's" : ""} number and your message ready to send.
              </p>
              {msgError && <div className="error">{msgError}</div>}
              <label>
                <span className="lbl">Message <span className="req">*</span></span>
                <textarea
                  rows={4}
                  autoFocus
                  placeholder="e.g. Your appointment is tomorrow at 3 PM. Please confirm."
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                />
              </label>
              <div className="row gap">
                <button type="submit" className="icon">
                  <Icon name="chat" size={18} /> Open in WhatsApp
                </button>
                <button type="button" className="btn-secondary" onClick={() => setMsgTarget(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="search-row">
        <input
          placeholder={isDependents ? "Search by child or guardian…" : "Search by name, email, or phone…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="icon search-btn" onClick={load} aria-label="Search">
          <Icon name="search" size={18} />
        </button>
      </div>

      {clients.length > 0 && (
        <div className="period-toggle" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className={`icon ${!onlyOutstanding ? "active" : ""}`}
            onClick={() => setOnlyOutstanding(false)}
          >
            <Icon name="group" size={16} /> All ({clients.length})
          </button>
          <button
            type="button"
            className={`icon ${onlyOutstanding ? "active" : ""}`}
            onClick={() => setOnlyOutstanding(true)}
          >
            <Icon name="account_balance_wallet" size={16} /> Outstanding ({outstandingCount})
          </button>
        </div>
      )}

      {showForm && (
      <div className="modal-backdrop" onClick={resetForm}>
        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} style={{ display: "contents" }}>
        <div className="modal-head">
          <h3>
            {editingId
              ? isDependents ? "Edit dependent" : "Edit patient"
              : isDependents ? "Add dependent (child)" : "Add new patient"}
          </h3>
          <button type="button" className="modal-close" aria-label="Close" onClick={resetForm}>
            <Icon name="close" />
          </button>
        </div>
        {error && <div className="error">{error}</div>}

        {form.managed ? (
          <>
            <div className="grid-2">
              <label>
                <span className="lbl">Patient name <span className="req">*</span></span>
                <input
                  required
                  autoCapitalize="words"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: titleCase(e.target.value) })}
                />
              </label>
              <label>
                <span className="lbl">Date of birth</span>
                <input
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                />
              </label>
            </div>
            <label>
              <span className="lbl">Guardian name <span className="req">*</span></span>
              <input
                required
                autoCapitalize="words"
                value={form.guardianName}
                onChange={(e) => setForm({ ...form, guardianName: titleCase(e.target.value) })}
              />
            </label>
            <label>
              <span className="lbl">Guardian phone <span className="req">*</span></span>
              <input
                type="tel"
                inputMode="numeric"
                required
                placeholder="e.g. 03001234567"
                value={form.guardianPhone}
                onChange={(e) =>
                  setForm({ ...form, guardianPhone: normalizePkPhone(e.target.value) })
                }
              />
            </label>
            <label>
              <span className="lbl">Guardian email <span className="muted">(optional)</span></span>
              <input
                type="email"
                value={form.guardianEmail}
                onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })}
              />
            </label>
          </>
        ) : (
          <>
            <div className="grid-2">
              <label>
                <span className="lbl">Name <span className="req">*</span></span>
                <input
                  name="name"
                  required
                  autoCapitalize="words"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: titleCase(e.target.value) })}
                />
              </label>
              <label>
                <span className="lbl">Email <span className="muted">(optional)</span></span>
                <input
                  type="email"
                  name="email"
                  disabled={!!editingId}
                  value={form.email}
                  onChange={handleChange}
                />
              </label>
            </div>
            <label>
              <span className="lbl">Phone <span className="req">*</span></span>
              <input
                name="phone"
                type="tel"
                inputMode="numeric"
                required
                placeholder="e.g. 03001234567"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: normalizePkPhone(e.target.value) })
                }
              />
            </label>
            {!editingId && (
              <label>
                <span className="lbl">Password (min 8) <span className="req">*</span></span>
                <PasswordInput
                  name="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  defaultVisible
                  value={form.password}
                  onChange={handleChange}
                />
              </label>
            )}
            {!editingId && (
              <label>
                <span className="lbl">Confirm password <span className="req">*</span></span>
                <PasswordInput
                  name="confirmPassword"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  defaultVisible
                  value={form.confirmPassword}
                  onChange={handleChange}
                />
              </label>
            )}
          </>
        )}
        <div className="row gap">
          <button type="submit">{editingId ? "Update" : isDependents ? "Add dependent" : "Add patient"}</button>
          <button type="button" className="btn-secondary" onClick={resetForm}>
            Cancel
          </button>
        </div>
        </form>
        </div>
      </div>
      )}

      {loadError && clients.length === 0 ? (
        <div className="card fin-error">
          <Icon name="cloud_off" size={28} />
          <p style={{ margin: 0 }}>
            Couldn't load {isDependents ? "dependents" : "patients"} — the connection may be slow.
            Nothing was lost; just try again.
          </p>
          <button type="button" className="icon" onClick={refresh} disabled={refreshing}>
            <Icon name="refresh" size={18} /> {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      ) : loading || (onlyOutstanding && !balancesLoaded) ? (
        <p className="muted icon"><Icon name="progress_activity" size={18} className="spin" /> Loading…</p>
      ) : visibleClients.length === 0 ? (
        <p className="muted">
          {onlyOutstanding
            ? `No ${isDependents ? "dependents" : "patients"} with an outstanding balance. 🎉`
            : isDependents
            ? "No dependents yet."
            : "No patients yet."}
        </p>
      ) : (
        <div className="appt-list patients-single">
          {visibleClients.map((c) => (
            <div
              key={c._id}
              className="appt-card"
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/clients/${c._id}`)}
              title="View patient record"
            >
              <div className="appt-card-head">
                <span className="appt-when icon">
                  <Icon name="person" size={18} /> {c.name}
                </span>
                <span className="row gap" style={{ gap: 6, flexWrap: "wrap" }}>
                  {c.managed && <span className="st st-scheduled">Child</span>}
                  {balances[c._id] > 0 && (
                    <span className="balance-badge" title="Outstanding balance">
                      <Icon name="account_balance_wallet" size={13} /> {money(balances[c._id])}
                    </span>
                  )}
                </span>
              </div>
              <div className="appt-card-body">
                {c.managed ? (
                  <>
                    <span className="icon"><Icon name="escalator_warning" size={16} /> Guardian: {c.guardianName || "—"}</span>
                    {c.guardianPhone && <span className="icon"><Icon name="call" size={16} /> {c.guardianPhone}</span>}
                    {c.guardianEmail && <span className="icon"><Icon name="mail" size={16} /> {c.guardianEmail}</span>}
                  </>
                ) : (
                  <>
                    {c.phone && <span className="icon"><Icon name="call" size={16} /> {c.phone}</span>}
                    {c.email && <span className="icon"><Icon name="mail" size={16} /> {c.email}</span>}
                  </>
                )}
                {c.dateOfBirth && (
                  <span className="icon"><Icon name="cake" size={16} /> {formatDate(c.dateOfBirth)}</span>
                )}
              </div>
              <div className="card-menu">
                <button
                  className="card-menu-btn"
                  aria-label="Actions"
                  aria-expanded={menuFor === c._id}
                  title="Actions"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuFor((id) => (id === c._id ? null : c._id));
                  }}
                >
                  <Icon name="more_vert" size={20} />
                </button>
                {menuFor === c._id && (
                  <>
                    <div
                      className="card-menu-backdrop"
                      onClick={(e) => { e.stopPropagation(); setMenuFor(null); }}
                    />
                    <div className="card-menu-panel" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="card-menu-item"
                        onClick={() => { setMenuFor(null); navigate(`/clients/${c._id}`); }}
                      >
                        <Icon name="history" size={18} /> History
                      </button>
                      <button
                        className="card-menu-item"
                        onClick={() => { setMenuFor(null); handleEdit(c); }}
                      >
                        <Icon name="edit" size={18} /> Edit
                      </button>
                      {(c.managed ? c.guardianPhone : c.phone) && (
                        <button
                          className="card-menu-item"
                          onClick={() => { setMenuFor(null); openMessage(c); }}
                        >
                          <Icon name="chat" size={18} /> Message
                        </button>
                      )}
                      {!c.managed && (
                        <button
                          className="card-menu-item"
                          onClick={() => { setMenuFor(null); openReset(c); }}
                        >
                          <Icon name="lock_reset" size={18} /> Reset password
                        </button>
                      )}
                      <button
                        className="card-menu-item danger"
                        onClick={() => { setMenuFor(null); handleDelete(c._id); }}
                      >
                        <Icon name="delete" size={18} /> Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
