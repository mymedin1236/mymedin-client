import { useEffect, useState } from "react";
import api from "../api/axios";
import { formatDate, formatDateTime } from "../utils/date";
import Icon from "../components/Icon";
import ClientSearchSelect from "../components/ClientSearchSelect";
import { COMMON_PROCEDURES } from "../data/procedures";
import ProcedureInput from "../components/ProcedureInput";
import { trackTreatment, trackPayment } from "../utils/analytics";

const money = (n) =>
  `Rs ${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const empty = {
  client: "",
  procedure: "",
  toothNumber: "",
  diagnosis: "",
  description: "",
  cost: "",
  upfront: "",
  date: new Date().toISOString().slice(0, 10),
};

export default function Treatments() {
  const [treatments, setTreatments] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(empty);
  const [filterClient, setFilterClient] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false); // in-flight lock so a double-click can't create duplicates
  const [showForm, setShowForm] = useState(false);
  // Record-payment modal
  const [payTarget, setPayTarget] = useState(null); // treatment being paid
  const [payForm, setPayForm] = useState({ amount: "", note: "", date: new Date().toISOString().slice(0, 10) });
  const [payError, setPayError] = useState("");

  const load = async () => {
    const params = filterClient ? { client: filterClient } : {};
    const [t, c] = await Promise.all([
      api.get("/treatments", { params }),
      api.get("/clients"),
    ]);
    setTreatments(t.data);
    setClients(c.data);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterClient]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const resetForm = () => {
    setForm(empty);
    setError("");
    setShowForm(false);
  };

  const openCreate = () => {
    setForm(empty);
    setError("");
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (saving) return; // ignore a second click while the first is still saving
    if (!form.client) return setError("Please select a patient.");
    const payload = { ...form, cost: Number(form.cost) || 0 };
    setSaving(true);
    try {
      await api.post("/treatments", payload);
      trackTreatment("created", { client_id: form.client });
      resetForm();
      load();
    } catch (err) {
      // Same-day duplicate for this patient — confirm before recording another.
      if (err.response?.status === 409 && err.response?.data?.code === "DUP_TREATMENT") {
        if (window.confirm("A matching treatment for this patient is already recorded today. Record it again anyway?")) {
          try {
            await api.post("/treatments", { ...payload, force: true });
            trackTreatment("created", { client_id: form.client, forced: true });
            resetForm();
            load();
          } catch (e2) {
            setError(e2.response?.data?.message || "Save failed");
          }
        }
      } else {
        setError(err.response?.data?.message || "Save failed");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this treatment?")) return;
    await api.delete(`/treatments/${id}`);
    trackTreatment("deleted", { treatment_id: id });
    load();
  };

  const openPayment = (t) => {
    setPayTarget(t);
    setPayForm({ amount: "", note: "", date: new Date().toISOString().slice(0, 10) });
    setPayError("");
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    setPayError("");
    if (!payForm.amount || Number(payForm.amount) <= 0)
      return setPayError("Enter a valid amount.");
    try {
      await api.post(`/treatments/${payTarget._id}/payments`, {
        amount: Number(payForm.amount),
        note: payForm.note,
        date: payForm.date,
      });
      trackPayment("created", { treatment_id: payTarget._id });
      setPayTarget(null);
      load();
    } catch (err) {
      setPayError(err.response?.data?.message || "Could not record payment.");
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="icon"><Icon name="medical_services" /> Treatments</h1>
        {!showForm && (
          <button className="icon" onClick={openCreate}>
            <Icon name="add_circle" size={18} /> Record treatment
          </button>
        )}
      </div>

      {showForm && (
      <div className="modal-backdrop" onClick={resetForm}>
        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit} style={{ display: "contents" }}>
        <h3 className="icon"><Icon name="add_circle" size={18} /> Record new treatment</h3>
        {error && <div className="error">{error}</div>}
        <div className="grid-2">
          <div className="field">
            Client
            <ClientSearchSelect
              clients={clients}
              value={form.client}
              onChange={(id) => setForm((f) => ({ ...f, client: id }))}
            />
          </div>
          <label>
            Procedure
            <ProcedureInput
              value={form.procedure}
              onChange={(v) => setForm((f) => ({ ...f, procedure: v }))}
              options={COMMON_PROCEDURES}
              required
            />
          </label>
          <label>
            Tooth #
            <input
              name="toothNumber"
              value={form.toothNumber}
              onChange={handleChange}
            />
          </label>
          <label>
            Diagnosis
            <input
              name="diagnosis"
              value={form.diagnosis}
              onChange={handleChange}
            />
          </label>
          <label>
            Total amount
            <input
              type="number"
              min="0"
              step="0.01"
              name="cost"
              placeholder="e.g. 50000"
              value={form.cost}
              onKeyDown={(e) => ["-", "+", "e", "E"].includes(e.key) && e.preventDefault()}
              onChange={handleChange}
            />
          </label>
          <label>
            Upfront payment (optional)
            <input
              type="number"
              min="0"
              step="0.01"
              name="upfront"
              placeholder="e.g. 25000"
              value={form.upfront}
              onKeyDown={(e) => ["-", "+", "e", "E"].includes(e.key) && e.preventDefault()}
              onChange={handleChange}
            />
          </label>
          <label>
            Date
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
            />
          </label>
        </div>
        <label>
          Description
          <textarea
            name="description"
            rows={2}
            value={form.description}
            onChange={handleChange}
          />
        </label>
        <div className="row gap">
          <button type="submit" className="icon" disabled={saving}>
            <Icon name="save" size={18} /> {saving ? "Saving…" : "Save treatment"}
          </button>
          <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>
        </div>
        </form>
        </div>
      </div>
      )}

      <div className="row gap">
        <div className="field" style={{ minWidth: 260 }}>
          Filter by patient:
          <ClientSearchSelect
            clients={clients}
            value={filterClient}
            onChange={setFilterClient}
            placeholder="All patients — search to filter…"
          />
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Client</th>
            <th>Procedure</th>
            <th>Total</th>
            <th>Paid</th>
            <th>Balance</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {treatments.map((t) => (
            <tr key={t._id}>
              <td>{formatDate(t.date)}</td>
              <td>{t.client?.name}</td>
              <td>{t.procedure}</td>
              <td>{money(t.cost)}</td>
              <td>{money(t.paidAmount)}</td>
              <td>{t.balance > 0 ? money(t.balance) : "—"}</td>
              <td className="row gap" style={{ justifyContent: "flex-end" }}>
                {t.balance > 0 && (
                  <button className="icon" onClick={() => openPayment(t)}>
                    <Icon name="payments" size={18} /> Record payment
                  </button>
                )}
                <button
                  className="btn-danger icon"
                  onClick={() => handleDelete(t._id)}
                >
                  <Icon name="delete" size={18} /> Delete
                </button>
              </td>
            </tr>
          ))}
          {treatments.length === 0 && (
            <tr>
              <td colSpan="7" className="muted">
                No treatments recorded.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Record-payment modal */}
      {payTarget && (
        <div className="modal-backdrop" onClick={() => setPayTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={submitPayment} style={{ display: "contents" }}>
              <h3 className="icon"><Icon name="payments" size={18} /> Record payment</h3>
              <p className="muted" style={{ margin: 0 }}>
                {payTarget.procedure} · {payTarget.client?.name} — balance{" "}
                <strong>{money(payTarget.balance)}</strong>
              </p>
              {payError && <div className="error">{payError}</div>}
              <div className="grid-2">
                <label>
                  Amount
                  <input
                    type="number"
                    min="0"
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
                </label>
              </div>
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
    </div>
  );
}
