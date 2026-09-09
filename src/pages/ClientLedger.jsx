import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { formatDate, formatDateTime } from "../utils/date";
import Icon from "../components/Icon";
import SlotPicker from "../components/SlotPicker";
import { SkeletonTable } from "../components/Skeleton";
import { COMMON_PROCEDURES } from "../data/procedures";
import ProcedureInput from "../components/ProcedureInput";
import { trackAppointment, trackTreatment, trackPayment, trackFollowUp } from "../utils/analytics";

const money = (n) => `Rs ${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const fmtDate = (x) => formatDate(x);

// Cash / Online segmented selector for how a payment was collected.
function MethodToggle({ value, onChange }) {
  return (
    <div className="period-toggle" style={{ marginTop: 4 }}>
      {[
        { v: "cash", label: "Cash", icon: "payments" },
        { v: "online", label: "Online", icon: "account_balance" },
      ].map((m) => (
        <button
          key={m.v}
          type="button"
          className={`icon ${value === m.v ? "active" : ""}`}
          onClick={() => onChange(m.v)}
        >
          <Icon name={m.icon} size={16} /> {m.label}
        </button>
      ))}
    </div>
  );
}

export default function ClientLedger() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sortOrder, setSortOrder] = useState("desc"); // newest first by default
  // Record-payment modal
  const [payTarget, setPayTarget] = useState(null);
  const [payForm, setPayForm] = useState({ amount: "", note: "", method: "cash", date: new Date().toISOString().slice(0, 10) });
  const [payError, setPayError] = useState("");
  // Edit-payment modal
  const [editPay, setEditPay] = useState(null); // { treatId, paymentId, amount, note, date }
  const [editPayError, setEditPayError] = useState("");
  // Record-treatment modal
  const TREAT_EMPTY = {
    procedure: "",
    site: "",
    diagnosis: "",
    description: "",
    prescription: "",
    cost: "",
    upfront: "",
    upfrontMethod: "cash",
    date: new Date().toISOString().slice(0, 10),
  };
  const [showTreat, setShowTreat] = useState(false);
  const [openMenu, setOpenMenu] = useState(null); // id of the open ⋯ menu (treatment or payment)
  const [treatForm, setTreatForm] = useState(TREAT_EMPTY);
  const [treatError, setTreatError] = useState("");
  const [savingTreat, setSavingTreat] = useState(false); // in-flight lock (prevents duplicate records)
  const [editingTreatId, setEditingTreatId] = useState(null);
  const [editTreatVersion, setEditTreatVersion] = useState(undefined);
  // Schedule-appointment modal
  const [showAppt, setShowAppt] = useState(false);
  const [apptForm, setApptForm] = useState({ reason: "", date: "", notes: "", appointmentType: "" });
  const [apptError, setApptError] = useState("");
  const [apptShare, setApptShare] = useState(null); // { whatsappUrl } after scheduling

  const loadTreatments = () =>
    api.get("/treatments", { params: { client: id } }).then((t) => setTreatments(t.data));

  useEffect(() => {
    (async () => {
      try {
        const [c, t] = await Promise.all([
          api.get(`/clients/${id}`),
          api.get("/treatments", { params: { client: id } }),
        ]);
        setClient(c.data);
        setTreatments(t.data);
      } catch (err) {
        if (err.response?.status === 404) setNotFound(true);
        else console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const openPayment = (t) => {
    setPayTarget(t);
    setPayForm({ amount: "", note: "", method: "cash", date: new Date().toISOString().slice(0, 10) });
    setPayError("");
  };

  const openTreat = () => {
    setEditingTreatId(null);
    setTreatForm(TREAT_EMPTY);
    setTreatError("");
    setShowTreat(true);
  };

  const openEditTreat = (t) => {
    setEditingTreatId(t._id);
    setEditTreatVersion(t.__v);
    setTreatForm({
      procedure: t.procedure || "",
      site: t.site || "",
      diagnosis: t.diagnosis || "",
      description: t.description || "",
      prescription: t.prescription || "",
      cost: t.cost ?? "",
      upfront: "",
      collected: t.paidAmount ?? 0, // read-only display on edit (from payments)
      date: t.date ? new Date(t.date).toISOString().slice(0, 10) : TREAT_EMPTY.date,
    });
    setTreatError("");
    setShowTreat(true);
  };

  const treatChange = (e) => setTreatForm({ ...treatForm, [e.target.name]: e.target.value });

  const openAppt = () => {
    setApptForm({ reason: "", date: "", notes: "" });
    setApptError("");
    setShowAppt(true);
  };

  const submitAppt = async (e) => {
    e.preventDefault();
    setApptError("");
    if (!apptForm.date) return setApptError("Pick a date and time.");
    if (new Date(apptForm.date).getTime() < Date.now())
      return setApptError("Appointment cannot be in the past.");
    try {
      const { data } = await api.post("/appointments", {
        client: id,
        reason: apptForm.reason,
        notes: apptForm.notes,
        date: apptForm.date, // already an ISO instant from the slot picker
        appointmentType: apptForm.appointmentType || undefined,
      });
      trackAppointment("booked", { appointment_id: data?.appointment?._id, actor: "doctor" });
      setShowAppt(false);
      setApptShare(data);
    } catch (err) {
      setApptError(err.response?.data?.message || "Could not schedule appointment.");
    }
  };

  const submitTreat = async (e) => {
    e.preventDefault();
    setTreatError("");
    if (savingTreat) return; // ignore a second click while the first is still saving
    if (!treatForm.procedure.trim()) return setTreatError("Procedure is required.");
    if (treatForm.cost === "" || Number(treatForm.cost) < 0)
      return setTreatError("Charges are required.");
    if (!treatForm.date) return setTreatError("Date is required.");
    if (!editingTreatId) {
      // A no-charge visit (charges = 0, e.g. a check-up) has nothing to collect,
      // so the collected amount and payment method aren't required.
      if (Number(treatForm.cost) > 0) {
        if (treatForm.upfront === "" || Number(treatForm.upfront) < 0)
          return setTreatError("Collected amount is required.");
        if (Number(treatForm.upfront) > Number(treatForm.cost))
          return setTreatError("Collected amount cannot exceed the charges.");
        if (!["cash", "online"].includes(treatForm.upfrontMethod))
          return setTreatError("Select a payment method (cash or online).");
      }
    } else {
      if (treatForm.collected === "" || Number(treatForm.collected) < 0)
        return setTreatError("Collected amount is required.");
      if (Number(treatForm.collected) > Number(treatForm.cost))
        return setTreatError("Collected amount cannot exceed the charges.");
    }
    const createPayload = {
      client: id,
      procedure: treatForm.procedure,
      site: treatForm.site,
      diagnosis: treatForm.diagnosis,
      description: treatForm.description,
      prescription: treatForm.prescription,
      cost: Number(treatForm.cost) || 0,
      upfront: Number(treatForm.upfront) || 0,
      upfrontMethod: treatForm.upfrontMethod,
      date: treatForm.date,
    };
    setSavingTreat(true);
    try {
      if (editingTreatId) {
        await api.put(`/treatments/${editingTreatId}`, {
          procedure: treatForm.procedure,
          site: treatForm.site,
          diagnosis: treatForm.diagnosis,
          description: treatForm.description,
          prescription: treatForm.prescription,
          cost: Number(treatForm.cost) || 0,
          collected: Number(treatForm.collected) || 0,
          date: treatForm.date,
          version: editTreatVersion,
        });
        trackTreatment("updated", { treatment_id: editingTreatId });
      } else {
        await api.post("/treatments", createPayload);
        trackTreatment("created", { client_id: id });
      }
      setShowTreat(false);
      await loadTreatments();
    } catch (err) {
      // A same-day duplicate for this patient — confirm before recording another.
      if (err.response?.status === 409 && err.response?.data?.code === "DUP_TREATMENT") {
        if (window.confirm("A matching treatment for this patient is already recorded today. Record it again anyway?")) {
          try {
            await api.post("/treatments", { ...createPayload, force: true });
            trackTreatment("created", { client_id: id, forced: true });
            setShowTreat(false);
            await loadTreatments();
          } catch (e2) {
            setTreatError(e2.response?.data?.message || "Could not save treatment.");
          }
        }
      } else {
        setTreatError(err.response?.data?.message || "Could not save treatment.");
        if (err.response?.status === 409) loadTreatments();
      }
    } finally {
      setSavingTreat(false);
    }
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    setPayError("");
    // Allow 0 (a "visit / no collection" log); reject only empty or negative.
    if (payForm.amount === "" || Number(payForm.amount) < 0)
      return setPayError("Enter a valid amount.");
    if (Number(payForm.amount) > payTarget.balance)
      return setPayError(`Amount cannot exceed the remaining balance (${money(payTarget.balance)}).`);
    try {
      await api.post(`/treatments/${payTarget._id}/payments`, {
        amount: Number(payForm.amount),
        note: payForm.note,
        method: payForm.method,
        date: payForm.date,
      });
      trackPayment("created", { treatment_id: payTarget._id });
      setPayTarget(null);
      await loadTreatments();
    } catch (err) {
      setPayError(err.response?.data?.message || "Could not record payment.");
      if (err.response?.status === 409) loadTreatments();
    }
  };

  const deleteTreat = async (t) => {
    if (!confirm(`Delete the "${t.procedure}" treatment and all its payments?`)) return;
    try {
      await api.delete(`/treatments/${t._id}`);
      trackTreatment("deleted", { treatment_id: t._id });
      await loadTreatments();
    } catch (err) {
      alert(err.response?.data?.message || "Could not delete treatment.");
    }
  };

  const resolveFollowUp = async (treatId, fid) => {
    try {
      await api.put(`/treatments/${treatId}/follow-up/${fid}/resolve`);
      trackFollowUp("resolved", { treatment_id: treatId, follow_up_id: fid });
      await loadTreatments();
    } catch (err) {
      alert(err.response?.data?.message || "Could not update the report.");
    }
  };

  const openEditPayment = (treatId, p) => {
    setEditPay({
      treatId,
      paymentId: p._id,
      amount: p.amount ?? "",
      note: p.note || "",
      method: p.method || "cash",
      date: p.date ? new Date(p.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    setEditPayError("");
  };

  const submitEditPayment = async (e) => {
    e.preventDefault();
    setEditPayError("");
    if (!editPay.amount || Number(editPay.amount) <= 0)
      return setEditPayError("Enter a valid amount.");
    const tr = treatments.find((t) => t._id === editPay.treatId);
    if (tr && tr.cost > 0) {
      const others = (tr.paidAmount || 0) - (tr.payments.find((p) => p._id === editPay.paymentId)?.amount || 0);
      const maxAllowed = tr.cost - others;
      if (Number(editPay.amount) > maxAllowed)
        return setEditPayError(`Amount cannot exceed the remaining balance (${money(maxAllowed)}).`);
    }
    try {
      await api.put(`/treatments/${editPay.treatId}/payments/${editPay.paymentId}`, {
        amount: Number(editPay.amount),
        note: editPay.note,
        method: editPay.method,
        date: editPay.date,
      });
      trackPayment("updated", { treatment_id: editPay.treatId, payment_id: editPay.paymentId });
      setEditPay(null);
      await loadTreatments();
    } catch (err) {
      setEditPayError(err.response?.data?.message || "Could not update payment.");
      if (err.response?.status === 409) loadTreatments();
    }
  };

  const deletePayment = async (treatId, paymentId) => {
    if (!confirm("Delete this payment?")) return;
    try {
      await api.delete(`/treatments/${treatId}/payments/${paymentId}`);
      trackPayment("deleted", { treatment_id: treatId, payment_id: paymentId });
      await loadTreatments();
    } catch (err) {
      alert(err.response?.data?.message || "Could not delete payment.");
      if (err.response?.status === 409) loadTreatments();
    }
  };

  const billed = treatments.reduce((s, t) => s + (t.cost || 0), 0);
  const collected = treatments.reduce((s, t) => s + (t.paidAmount || 0), 0);
  const outstanding = Math.max(0, billed - collected);

  // Sort by date, then by the recorded time (createdAt) so same-day entries order correctly
  const stamp = (t) => {
    const day = new Date(t.date).getTime() || 0;
    const created = new Date(t.createdAt || t.date).getTime() || 0;
    return { day, created };
  };
  const sorted = [...treatments].sort((a, b) => {
    const sa = stamp(a);
    const sb = stamp(b);
    const diff = sa.day - sb.day || sa.created - sb.created;
    return sortOrder === "desc" ? -diff : diff;
  });

  if (loading)
    return (
      <div className="page">
        <h1 className="icon"><Icon name="account_circle" /> Client</h1>
        <SkeletonTable rows={4} cols={3} />
      </div>
    );
  if (notFound || !client)
    return <div className="page"><p className="muted">Client not found.</p></div>;

  return (
    <div className="page">
      <button className="ledger-back btn-secondary icon" onClick={() => navigate(-1)}>
        <Icon name="arrow_back" size={18} /> Back
      </button>
      <div className="page-head">
        <h1 className="icon"><Icon name="account_circle" /> {client.name}</h1>
        <button className="icon" onClick={openAppt}>
          <Icon name="event" size={18} /> Schedule appointment
        </button>
      </div>

      {apptShare && (
        <div className="card" style={{ maxWidth: "none", borderColor: "var(--primary)" }}>
          <h3 className="icon"><Icon name="event_available" size={18} /> Appointment scheduled</h3>
          <p className="muted" style={{ margin: 0 }}>
            {client.name} has been notified in-app and by email. You can also send a WhatsApp reminder:
          </p>
          <div className="row gap" style={{ flexWrap: "wrap" }}>
            <a
              className="btn-whatsapp"
              href={apptShare.whatsappUrl}
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="chat" size={18} /> Share via WhatsApp
            </a>
            <button
              type="button"
              className="btn-secondary"
              style={{ borderColor: "var(--primary)", color: "var(--primary)" }}
              onClick={() => setApptShare(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <p className="muted" style={{ marginTop: -8 }}>
        {client.managed
          ? `Child · Guardian: ${client.guardianName || "—"}${client.guardianPhone ? ` · ${client.guardianPhone}` : ""}${client.guardianEmail ? ` · ${client.guardianEmail}` : ""}`
          : `${client.email || ""}${client.phone ? ` · ${client.phone}` : ""}`}
      </p>

      <div className="row gap" style={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
        <h2 className="icon" style={{ margin: 0 }}><Icon name="medical_services" /> Treatments &amp; payments</h2>
        <div className="row gap" style={{ flexWrap: "wrap" }}>
          {treatments.length > 1 && (
            <label className="sort-label">
              <Icon name="sort" size={18} />
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>
            </label>
          )}
          {outstanding > 0 ? (
            <span
              className="treat-locked icon"
              title={`This patient has ${money(outstanding)} outstanding. Record the payment before adding a new treatment.`}
            >
              <Icon name="lock" size={16} /> Clear {money(outstanding)} due before adding a treatment
            </span>
          ) : (
            <button className="icon" onClick={openTreat}>
              <Icon name="add_circle" size={18} /> Record treatment
            </button>
          )}
        </div>
      </div>
      {treatments.length === 0 ? (
        <p className="muted">No treatments recorded for this client yet.</p>
      ) : (
        sorted.map((t) => (
          <div className="card" key={t._id} style={{ maxWidth: "none" }}>
            <div className="row gap" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <div>
                <strong>{t.procedure}</strong>
                <div className="muted" style={{ fontSize: 13 }}>
                  {fmtDate(t.date)}
                  {t.site ? ` · ${t.site}` : ""}
                  {t.diagnosis ? ` · ${t.diagnosis}` : ""}
                </div>
                {t.prescription && (
                  <div className="rx-note icon">
                    <Icon name="prescriptions" size={15} />
                    <span>{t.prescription}</span>
                  </div>
                )}
              </div>
              <div className="row gap" style={{ flexWrap: "wrap", alignItems: "center" }}>
                {t.cost > 0 ? (
                  <>
                    <span className="tag pill-billed">Billed {money(t.cost)}</span>
                    <span className="tag pill-collected">Collected {money(t.paidAmount)}</span>
                    <span className={`tag ${t.balance > 0 ? "pill-outstanding" : "pill-collected"}`}>
                      {t.balance > 0 ? `Outstanding ${money(t.balance)}` : "Fully paid"}
                    </span>
                    {t.balance > 0 && (
                      <button className="icon" onClick={() => openPayment(t)}>
                        <Icon name="payments" size={18} /> Record payment
                      </button>
                    )}
                  </>
                ) : (
                  <span className="tag pill-billed">No charge</span>
                )}
                <span className="row-menu">
                  <button
                    className="card-menu-btn"
                    aria-label="More actions"
                    aria-expanded={openMenu === t._id}
                    title="More actions"
                    onClick={() => setOpenMenu((id) => (id === t._id ? null : t._id))}
                  >
                    <Icon name="more_vert" size={20} />
                  </button>
                  {openMenu === t._id && (
                    <>
                      <div className="card-menu-backdrop" onClick={() => setOpenMenu(null)} />
                      <div className="card-menu-panel">
                        <button className="card-menu-item" onClick={() => { setOpenMenu(null); openEditTreat(t); }}>
                          <Icon name="edit" size={18} /> Edit
                        </button>
                        <button className="card-menu-item danger" onClick={() => { setOpenMenu(null); deleteTreat(t); }}>
                          <Icon name="delete" size={18} /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </span>
              </div>
            </div>

            {t.followUps?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {[...t.followUps]
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .map((f) => (
                    <div
                      key={f._id}
                      className="row gap"
                      style={{
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        borderTop: "1px solid var(--border)",
                        paddingTop: 8,
                        marginTop: 8,
                      }}
                    >
                      <Icon name="report" size={18} style={{ color: "var(--danger)" }} />
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div>
                          <strong>Patient reported a problem</strong>{" "}
                          <span className="muted" style={{ fontSize: 12 }}>· {fmtDate(f.createdAt)}</span>
                        </div>
                        <div style={{ fontSize: 14 }}>{f.message}</div>
                      </div>
                      {f.status === "open" ? (
                        <button className="btn-secondary icon" onClick={() => resolveFollowUp(t._id, f._id)}>
                          <Icon name="check" size={16} /> Mark resolved
                        </button>
                      ) : (
                        <span className="badge icon"><Icon name="check_circle" size={14} /> Resolved</span>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {t.payments?.length > 0 && (
              <div className="timeline">
                {[...t.payments]
                  .sort((a, b) => new Date(a.date) - new Date(b.date))
                  .map((p, i) => (
                    <div className="timeline-item" key={p._id || i}>
                      <Icon name="payments" size={16} />
                      <span className="muted">{fmtDate(p.date)}</span>
                      <strong>{p.amount > 0 ? money(p.amount) : "No charge"}</strong>
                      {p.amount > 0 && p.method && (
                        <span className="tag icon">
                          <Icon name={p.method === "online" ? "account_balance" : "payments"} size={14} />
                          {p.method === "online" ? "Online" : "Cash"}
                        </span>
                      )}
                      {p.note && <span className="muted">· {p.note}</span>}
                      {p._id && (
                        <span className="row-menu timeline-actions">
                          <button
                            type="button"
                            className="card-menu-btn"
                            title="Payment actions"
                            aria-label="Payment actions"
                            aria-expanded={openMenu === p._id}
                            onClick={() => setOpenMenu((id) => (id === p._id ? null : p._id))}
                          >
                            <Icon name="more_vert" size={18} />
                          </button>
                          {openMenu === p._id && (
                            <>
                              <div className="card-menu-backdrop" onClick={() => setOpenMenu(null)} />
                              <div className="card-menu-panel">
                                <button
                                  type="button"
                                  className="card-menu-item"
                                  onClick={() => { setOpenMenu(null); openEditPayment(t._id, p); }}
                                >
                                  <Icon name="edit" size={16} /> Edit
                                </button>
                                <button
                                  type="button"
                                  className="card-menu-item danger"
                                  onClick={() => { setOpenMenu(null); deletePayment(t._id, p._id); }}
                                >
                                  <Icon name="delete" size={16} /> Delete
                                </button>
                              </div>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))
      )}

      {treatments.length > 0 && (
        <div className="ledger-footer">
          <div className="ledger-stat">
            <span className="ledger-stat-label">Billed</span>
            <span className="ledger-stat-value">{money(billed)}</span>
          </div>
          <div className="ledger-stat net">
            <span className="ledger-stat-label">Net collected</span>
            <span className="ledger-stat-value">{money(collected)}</span>
          </div>
          <div className="ledger-stat out">
            <span className="ledger-stat-label">Outstanding</span>
            <span className="ledger-stat-value">{money(outstanding)}</span>
          </div>
        </div>
      )}

      {/* Schedule-appointment modal */}
      {showAppt && (
        <div className="modal-backdrop" onClick={() => setShowAppt(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={submitAppt} style={{ display: "contents" }}>
              <div className="modal-head">
                <h3 className="icon"><Icon name="event" size={18} /> Schedule appointment for {client.name}</h3>
                <button type="button" className="modal-close" aria-label="Close" onClick={() => setShowAppt(false)}>
                  <Icon name="close" />
                </button>
              </div>
              {apptError && <div className="error">{apptError}</div>}
              <label>
                <span className="lbl">Purpose <span className="muted">(optional)</span></span>
                <input
                  placeholder="e.g. Checkup, Braces adjustment"
                  value={apptForm.reason}
                  onChange={(e) => setApptForm({ ...apptForm, reason: e.target.value })}
                />
              </label>
              <SlotPicker
                value={apptForm.date}
                onChange={(iso, slot) =>
                  setApptForm({ ...apptForm, date: iso, appointmentType: slot?.typeId || "" })
                }
              />
              <div className="row gap">
                <button type="submit" className="icon"><Icon name="event" size={18} /> Schedule</button>
                <button type="button" className="btn-secondary" onClick={() => setShowAppt(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record-treatment modal */}
      {showTreat && (
        <div className="modal-backdrop" onClick={() => setShowTreat(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={submitTreat} style={{ display: "contents" }}>
              <div className="modal-head">
                <h3 className="icon">
                  <Icon name={editingTreatId ? "edit" : "add_circle"} size={18} />
                  {editingTreatId ? "Edit treatment" : `Record treatment for ${client.name}`}
                </h3>
                <button type="button" className="modal-close" aria-label="Close" onClick={() => setShowTreat(false)}>
                  <Icon name="close" />
                </button>
              </div>
              {treatError && <div className="error">{treatError}</div>}
              <div className="grid-2">
                <label>
                  <span className="lbl">Procedure <span className="req">*</span></span>
                  <ProcedureInput
                    value={treatForm.procedure}
                    onChange={(v) => setTreatForm((f) => ({ ...f, procedure: v }))}
                    options={COMMON_PROCEDURES}
                    required
                  />
                </label>
                <label>
                  Site / Location
                  <input name="site" value={treatForm.site} onChange={treatChange} placeholder="optional" />
                </label>
                <label>
                  <span className="lbl">Charges <span className="req">*</span></span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="cost"
                    required
                    placeholder="e.g. 50000"
                    value={treatForm.cost}
                    onKeyDown={(e) => ["-", "+", "e", "E"].includes(e.key) && e.preventDefault()}
                    onChange={treatChange}
                  />
                </label>
                {editingTreatId && (
                  <label>
                    <span className="lbl">Collected amount <span className="req">*</span></span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="collected"
                      value={treatForm.collected}
                      onKeyDown={(e) => ["-", "+", "e", "E"].includes(e.key) && e.preventDefault()}
                      onChange={treatChange}
                    />
                    <span className="muted" style={{ fontSize: 12 }}>
                      Changing this adds a correcting entry to the payments below.
                    </span>
                  </label>
                )}
                {!editingTreatId && (
                  <label>
                    <span className="lbl">
                      Collected now{" "}
                      {Number(treatForm.cost) > 0
                        ? <span className="req">*</span>
                        : <span className="muted">(optional)</span>}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="upfront"
                      required={Number(treatForm.cost) > 0}
                      placeholder="e.g. 3000"
                      value={treatForm.upfront}
                      onKeyDown={(e) => ["-", "+", "e", "E"].includes(e.key) && e.preventDefault()}
                      onChange={treatChange}
                    />
                    {Number(treatForm.cost) > 0 && treatForm.upfront !== "" && (
                      <span className="muted" style={{ fontSize: 12 }}>
                        Outstanding: {money(Math.max(0, Number(treatForm.cost) - Number(treatForm.upfront || 0)))}
                      </span>
                    )}
                  </label>
                )}
                {!editingTreatId && (
                  <label>
                    <span className="lbl">
                      Payment method{" "}
                      {Number(treatForm.cost) > 0
                        ? <span className="req">*</span>
                        : <span className="muted">(optional)</span>}
                    </span>
                    <MethodToggle
                      value={treatForm.upfrontMethod}
                      onChange={(m) => setTreatForm({ ...treatForm, upfrontMethod: m })}
                    />
                  </label>
                )}
                <label>
                  Diagnosis
                  <input name="diagnosis" value={treatForm.diagnosis} onChange={treatChange} />
                </label>
                <label>
                  <span className="lbl">Date <span className="req">*</span></span>
                  <input type="date" name="date" required value={treatForm.date} onChange={treatChange} />
                  {treatForm.date && (
                    <span className="muted" style={{ fontSize: 12 }}>{fmtDate(treatForm.date)}</span>
                  )}
                </label>
              </div>
              <label>
                Description
                <textarea name="description" rows={2} value={treatForm.description} onChange={treatChange} />
              </label>
              <label>
                <span className="lbl icon"><Icon name="prescriptions" size={16} /> Prescription / advice</span>
                <textarea
                  name="prescription"
                  rows={2}
                  placeholder="e.g. Avoid eating hard things, avoid hot drinks for 2 days"
                  value={treatForm.prescription}
                  onChange={treatChange}
                />
                <span className="muted" style={{ fontSize: 12 }}>The patient can see this in their app.</span>
              </label>
              <div className="row gap">
                <button type="submit" className="icon" disabled={savingTreat}>
                  <Icon name="save" size={18} />{" "}
                  {savingTreat ? "Saving…" : editingTreatId ? "Save changes" : "Save treatment"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowTreat(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record-payment modal */}
      {payTarget && (
        <div className="modal-backdrop" onClick={() => setPayTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={submitPayment} style={{ display: "contents" }}>
              <h3 className="icon"><Icon name="payments" size={18} /> Record payment</h3>
              <p className="muted" style={{ margin: 0 }}>
                {payTarget.procedure} — balance <strong>{money(payTarget.balance)}</strong>
              </p>
              {payError && <div className="error">{payError}</div>}
              <div className="grid-2">
                <label>
                  Amount
                  <input
                    type="number"
                    min="0"
                    max={payTarget.balance}
                    step="0.01"
                    placeholder="e.g. 2000"
                    value={payForm.amount}
                    onKeyDown={(e) => ["-", "+", "e", "E"].includes(e.key) && e.preventDefault()}
                    onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  />
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    value={payForm.date}
                    onChange={(e) => setPayForm({ ...payForm, date: e.target.value })}
                  />
                  {payForm.date && (
                    <span className="muted" style={{ fontSize: 12 }}>{fmtDate(payForm.date)}</span>
                  )}
                </label>
              </div>
              <label>
                <span className="lbl">Paid via <span className="req">*</span></span>
                <MethodToggle value={payForm.method} onChange={(m) => setPayForm({ ...payForm, method: m })} />
              </label>
              <label>
                Note (optional)
                <input
                  placeholder="e.g. Visit 3 adjustment"
                  value={payForm.note}
                  onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
                />
              </label>
              <div className="row gap">
                <button type="submit" className="icon"><Icon name="check" size={18} /> Save payment</button>
                <button type="button" className="btn-secondary" onClick={() => setPayTarget(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit-payment modal */}
      {editPay && (
        <div className="modal-backdrop" onClick={() => setEditPay(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={submitEditPayment} style={{ display: "contents" }}>
              <div className="modal-head">
                <h3 className="icon"><Icon name="edit" size={18} /> Edit payment</h3>
                <button type="button" className="modal-close" aria-label="Close" onClick={() => setEditPay(null)}>
                  <Icon name="close" />
                </button>
              </div>
              {editPayError && <div className="error">{editPayError}</div>}
              <div className="grid-2">
                <label>
                  Amount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editPay.amount}
                    onKeyDown={(e) => ["-", "+", "e", "E"].includes(e.key) && e.preventDefault()}
                    onChange={(e) => setEditPay({ ...editPay, amount: e.target.value })}
                  />
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    value={editPay.date}
                    onChange={(e) => setEditPay({ ...editPay, date: e.target.value })}
                  />
                  {editPay.date && (
                    <span className="muted" style={{ fontSize: 12 }}>{fmtDate(editPay.date)}</span>
                  )}
                </label>
              </div>
              <label>
                <span className="lbl">Paid via <span className="req">*</span></span>
                <MethodToggle value={editPay.method} onChange={(m) => setEditPay({ ...editPay, method: m })} />
              </label>
              <label>
                Note (optional)
                <input
                  value={editPay.note}
                  onChange={(e) => setEditPay({ ...editPay, note: e.target.value })}
                />
              </label>
              <div className="row gap">
                <button type="submit" className="icon"><Icon name="save" size={18} /> Save changes</button>
                <button type="button" className="btn-secondary" onClick={() => setEditPay(null)}>
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
