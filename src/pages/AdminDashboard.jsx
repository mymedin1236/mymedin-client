import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import "../styles/admin.css";

const fmt = (d) => new Date(d).toLocaleString();
const shortUA = (ua = "") => {
  if (/iphone|ipad/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/edg/i.test(ua)) return "Edge";
  if (/chrome/i.test(ua)) return "Chrome";
  if (/firefox/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  return ua.slice(0, 24) || "—";
};

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [hours, setHours] = useState(24);
  const [tab, setTab] = useState("logins"); // logins | users | enrollments | invoices
  const [successFilter, setSuccessFilter] = useState("all"); // all | true | false
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [clinics, setClinics] = useState([]); // e-agreement enrollments
  const [invoices, setInvoices] = useState([]);
  const [defaultFee, setDefaultFee] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // User-tab filters
  const [userPwa, setUserPwa] = useState("all"); // all | installed | not
  const [userRole, setUserRole] = useState("");
  const [userSearch, setUserSearch] = useState("");

  // "View as" — open the doctor's own, real screens (read-only) in a new tab,
  // without ever needing their password. The server mints a short-lived
  // read-only token and hands back a link into the app's own /impersonate route.
  const [viewingId, setViewingId] = useState(null);
  const viewAs = async (doctorId) => {
    setViewingId(doctorId);
    try {
      const { data } = await api.post(`/admin/impersonate/${doctorId}`);
      window.open(data.url, "_blank", "noopener");
    } catch (e) {
      alert(e?.response?.data?.message || "Could not open view.");
    } finally {
      setViewingId(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const s = await api.get(`/admin/summary?hours=${hours}`);
      setSummary(s.data);
      if (tab === "logins") {
        const r = await api.get(`/admin/logins?hours=${hours}&success=${successFilter}&limit=1000`);
        setEvents(r.data.events || []);
      } else if (tab === "enrollments") {
        const r = await api.get(`/admin/enrollments`);
        setClinics(r.data.clinics || []);
      } else if (tab === "invoices") {
        const [inv, enr] = await Promise.all([
          api.get(`/admin/invoices`),
          api.get(`/admin/enrollments`),
        ]);
        setInvoices(inv.data.invoices || []);
        setDefaultFee(inv.data.defaultFee || 0);
        setClinics(enr.data.clinics || []);
      } else {
        const p = new URLSearchParams({ limit: "1000" });
        if (userPwa !== "all") p.set("pwa", userPwa);
        if (userRole) p.set("role", userRole);
        if (userSearch.trim()) p.set("search", userSearch.trim());
        const r = await api.get(`/admin/users?${p.toString()}`);
        setUsers(r.data.users || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Could not load data.");
    } finally {
      setLoading(false);
    }
  }, [hours, tab, successFilter, userPwa, userRole, userSearch]);

  // ---- Invoice / billing actions ----
  const saveBilling = async (doctorId, startMonth, monthlyFee) => {
    setBusy(true);
    try {
      await api.put(`/admin/doctors/${doctorId}/billing`, { startMonth, monthlyFee });
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Could not save billing.");
    } finally {
      setBusy(false);
    }
  };

  const generateInvoices = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/invoices/generate`);
      await load();
      alert(data.created ? `Generated ${data.created} invoice(s).` : "No new invoices were due.");
    } catch (err) {
      alert(err.response?.data?.message || "Could not generate invoices.");
    } finally {
      setBusy(false);
    }
  };

  const setInvoiceStatus = async (id, status) => {
    setBusy(true);
    try {
      await api.patch(`/admin/invoices/${id}`, { status });
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Could not update invoice.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const deleteEvent = async (id) => {
    if (!confirm("Delete this login record?")) return;
    try {
      await api.delete(`/admin/logins/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Could not delete.");
    }
  };

  const clearAll = async () => {
    if (!confirm("Delete ALL login records? This cannot be undone.")) return;
    try {
      await api.delete("/admin/logins");
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Could not clear.");
    }
  };

  const onLogout = () => {
    logout();
    navigate("/admin");
  };

  return (
    <div className="admin-app">
      <header className="topbar">
        <div>
          <strong>MyMedin</strong> <span className="muted">· Admin</span>
        </div>
        <div className="row">
          <span className="muted">{user?.name || user?.email}</span>
          <button className="ghost" onClick={load} disabled={loading}>↻ Refresh</button>
          <button className="ghost" onClick={onLogout}>Logout</button>
        </div>
      </header>

      <main className="container">
        <div className="row between wrap">
          <div className="row wrap">
            <button className={tab === "logins" ? "tab on" : "tab"} onClick={() => setTab("logins")}>
              Login activity
            </button>
            <button className={tab === "users" ? "tab on" : "tab"} onClick={() => setTab("users")}>
              Users
            </button>
            <button className={tab === "enrollments" ? "tab on" : "tab"} onClick={() => setTab("enrollments")}>
              Enrollments
            </button>
            <button className={tab === "invoices" ? "tab on" : "tab"} onClick={() => setTab("invoices")}>
              Invoices
            </button>
          </div>
          <label className="row">
            Window:
            <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              <option value={24}>Last 24 hours</option>
              <option value={72}>Last 3 days</option>
              <option value={168}>Last 7 days</option>
              <option value={720}>Last 30 days</option>
            </select>
          </label>
        </div>

        {summary && (
          <div className="cards">
            <Stat label={`Logins (last ${summary.hours}h)`} value={summary.logins.success} />
            <Stat label="Unique users" value={summary.logins.uniqueUsers} />
            <Stat
              label="From PWA"
              value={`${summary.logins.pwa ?? 0} / ${summary.logins.success}`}
            />
            <Stat label="Failed attempts" value={summary.logins.failed} warn={summary.logins.failed > 0} />
            <Stat label="Total users" value={summary.totalUsers} />
          </div>
        )}

        {summary && (
          <div className="muted small">
            Active by role: {Object.entries(summary.loginsByRole).map(([r, c]) => `${r}: ${c}`).join("  ·  ") || "—"}
            {"   |   "}
            Users by role: {Object.entries(summary.usersByRole).map(([r, c]) => `${r}: ${c}`).join("  ·  ")}
          </div>
        )}

        {error && <div className="error">{error}</div>}

        {tab === "logins" && (
          <>
            <div className="row between wrap" style={{ margin: "12px 0" }}>
              <div className="row wrap">
                <span className="muted">Show:</span>
                {["all", "true", "false"].map((v) => (
                  <button
                    key={v}
                    className={successFilter === v ? "chip on" : "chip"}
                    onClick={() => setSuccessFilter(v)}
                  >
                    {v === "all" ? "All" : v === "true" ? "Successful" : "Failed"}
                  </button>
                ))}
              </div>
              {events.length > 0 && (
                <button className="danger" onClick={clearAll} disabled={loading}>
                  Clear all
                </button>
              )}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th><th>Name</th><th>Identifier</th><th>Role</th>
                    <th>Result</th><th>Via</th><th>IP</th><th>Device</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="muted">Loading…</td></tr>
                  ) : events.length === 0 ? (
                    <tr><td colSpan={9} className="muted">No logins in this window.</td></tr>
                  ) : (
                    events.map((e) => (
                      <tr key={e._id}>
                        <td className="nowrap">{fmt(e.createdAt)}</td>
                        <td>{e.name || "—"}</td>
                        <td>{e.identifier || "—"}</td>
                        <td>{e.role || "—"}</td>
                        <td>
                          {e.success ? (
                            <span className="ok">Success</span>
                          ) : (
                            <span className="bad" title={e.reason}>Failed</span>
                          )}
                        </td>
                        <td>
                          {e.pwa ? <span className="ok">PWA</span> : <span className="muted">Browser</span>}
                        </td>
                        <td className="nowrap">{e.ip || "—"}</td>
                        <td title={e.userAgent}>{shortUA(e.userAgent)}</td>
                        <td>
                          <button
                            className="link-danger"
                            title="Delete this record"
                            onClick={() => deleteEvent(e._id)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "users" && (
          <>
            <div className="row between wrap" style={{ margin: "12px 0" }}>
              <div className="row wrap">
                <span className="muted">PWA:</span>
                {[
                  ["all", "All"],
                  ["installed", "On PWA"],
                  ["not", "Not on PWA"],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    className={userPwa === v ? "chip on" : "chip"}
                    onClick={() => setUserPwa(v)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="row wrap">
                <select value={userRole} onChange={(e) => setUserRole(e.target.value)}>
                  <option value="">All roles</option>
                  <option value="client">Patients</option>
                  <option value="doctor">Doctors</option>
                  <option value="assistant">Assistants</option>
                  <option value="vendor">Vendors</option>
                  <option value="admin">Admins</option>
                </select>
                <input
                  placeholder="Search name / email / phone…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="muted small" style={{ marginBottom: 8 }}>
              {users.length} user{users.length === 1 ? "" : "s"}
              {userPwa === "not" ? " who last opened in a browser (candidates to install the app)" : ""}
            </div>
            <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Clinic</th><th>Last via</th><th>Joined</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="muted">Loading…</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={7} className="muted">No users.</td></tr>
                ) : (
                  users.map((u) => (
                    <tr key={u._id}>
                      <td>{u.name}{u.managed ? " (dependent)" : ""}</td>
                      <td>{u.email || "—"}</td>
                      <td className="nowrap">{u.phone || "—"}</td>
                      <td>{u.role}</td>
                      <td>{u.clinicName || "—"}</td>
                      <td>
                        {u.lastLoginPwa === true ? (
                          <span className="ok">PWA</span>
                        ) : u.lastLoginPwa === false ? (
                          <span className="muted">Browser</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="nowrap">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </>
        )}

        {tab === "enrollments" && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Clinic</th><th>Doctor</th><th>Contact</th><th>Status</th><th>Enrolled</th><th>Discovery ends</th><th></th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="muted">Loading…</td></tr>
                ) : clinics.length === 0 ? (
                  <tr><td colSpan={7} className="muted">No clinics.</td></tr>
                ) : (
                  clinics.map((c) => {
                    const daysLeft = c.discoveryEnd
                      ? Math.ceil((new Date(c.discoveryEnd).getTime() - Date.now()) / 86400000)
                      : null;
                    return (
                      <tr key={c._id}>
                        <td>{c.clinicName || "—"}</td>
                        <td>{c.name}</td>
                        <td className="nowrap">{c.phone || c.email || "—"}</td>
                        <td className="nowrap">
                          {c.phase === "paid" ? (
                            <span className="ok">Paid · Rs 3000/mo</span>
                          ) : c.phase === "discovery" ? (
                            <span style={{ color: "#1a5fb4", fontWeight: 700 }}>
                              Discovery{daysLeft != null ? ` · ${daysLeft}d left` : ""}
                            </span>
                          ) : (
                            <span className="muted">Not signed</span>
                          )}
                        </td>
                        <td className="nowrap">{c.acceptedAt ? new Date(c.acceptedAt).toLocaleDateString() : "—"}</td>
                        <td className="nowrap">{c.discoveryEnd ? new Date(c.discoveryEnd).toLocaleDateString() : "—"}</td>
                        <td className="nowrap">
                          <button
                            className="btn-sm"
                            disabled={viewingId === c._id}
                            onClick={() => viewAs(c._id)}
                            title="Open this clinic's view (read-only) in a new tab"
                          >
                            {viewingId === c._id ? "Opening…" : "View as"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "invoices" && (
          <div style={{ display: "grid", gap: 16 }}>
            <section className="card" style={{ padding: 16 }}>
              <div className="row between wrap">
                <h3 style={{ margin: 0 }}>Billing setup</h3>
                <button onClick={generateInvoices} disabled={busy}>
                  {busy ? "Working…" : "Generate due invoices"}
                </button>
              </div>
              <p className="muted" style={{ marginTop: 6 }}>
                Set each clinic's first billing month (YYYY-MM). Invoices are issued on the 5th
                and due on the 15th, at Rs {Number(defaultFee).toLocaleString()}/month unless a
                per-clinic fee is set.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Clinic</th><th>Start month</th><th>Monthly fee</th><th></th></tr>
                  </thead>
                  <tbody>
                    {clinics.length === 0 ? (
                      <tr><td colSpan={4} className="muted">No clinics.</td></tr>
                    ) : (
                      clinics.map((c) => (
                        <BillingRow key={c._id} clinic={c} defaultFee={defaultFee} busy={busy} onSave={saveBilling} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Clinic</th><th>Month</th><th>Amount</th><th>Issued</th><th>Due</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="muted">Loading…</td></tr>
                  ) : invoices.length === 0 ? (
                    <tr><td colSpan={7} className="muted">No invoices yet. Set a start month above, then “Generate due invoices”.</td></tr>
                  ) : (
                    invoices.map((iv) => {
                      const overdue = iv.status === "unpaid" && new Date(iv.dueDate) < new Date();
                      return (
                        <tr key={iv._id}>
                          <td>{iv.doctor?.clinicName || iv.doctor?.name || "—"}</td>
                          <td className="nowrap">{iv.month}</td>
                          <td className="nowrap">Rs {Number(iv.amount).toLocaleString()}</td>
                          <td className="nowrap">{new Date(iv.issueDate).toLocaleDateString()}</td>
                          <td className="nowrap">{new Date(iv.dueDate).toLocaleDateString()}</td>
                          <td className="nowrap">
                            {iv.status === "paid" ? (
                              <span className="ok">Paid{iv.paidAt ? ` · ${new Date(iv.paidAt).toLocaleDateString()}` : ""}</span>
                            ) : overdue ? (
                              <span className="bad">Overdue</span>
                            ) : (
                              <span className="muted">Unpaid</span>
                            )}
                          </td>
                          <td className="nowrap">
                            {iv.status === "paid" ? (
                              <button className="ghost btn-sm" disabled={busy} onClick={() => setInvoiceStatus(iv._id, "unpaid")}>Mark unpaid</button>
                            ) : (
                              <button className="btn-sm" disabled={busy} onClick={() => setInvoiceStatus(iv._id, "paid")}>Mark paid</button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, warn }) {
  return (
    <div className={warn ? "stat warn" : "stat"}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// One editable billing row per clinic: first billing month + optional fee override.
function BillingRow({ clinic, defaultFee, busy, onSave }) {
  const [month, setMonth] = useState(clinic.billing?.startMonth || "");
  const [fee, setFee] = useState(
    clinic.billing?.monthlyFee != null ? String(clinic.billing.monthlyFee) : ""
  );
  const dirty =
    month !== (clinic.billing?.startMonth || "") ||
    fee !== (clinic.billing?.monthlyFee != null ? String(clinic.billing.monthlyFee) : "");
  return (
    <tr>
      <td>{clinic.clinicName || clinic.name || "—"}</td>
      <td className="nowrap">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </td>
      <td className="nowrap">
        <input
          type="number"
          placeholder={`Rs ${Number(defaultFee).toLocaleString()}`}
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          style={{ width: 120 }}
        />
      </td>
      <td className="nowrap">
        <button className="btn-sm" disabled={busy || !dirty} onClick={() => onSave(clinic._id, month, fee)}>
          Save
        </button>
      </td>
    </tr>
  );
}
