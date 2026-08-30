import { useEffect, useState } from "react";
import api from "../api/axios";
import { formatDate } from "../utils/date";
import Icon from "../components/Icon";
import { SkeletonTable } from "../components/Skeleton";

const CATEGORIES = [
  "Machine maintenance",
  "Equipment repair",
  "Consumables",
  "Sterilization",
  "Utilities",
  "Rent",
  "Staff",
  "Other",
];

const money = (n) =>
  `Rs ${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const todayISO = () => new Date().toISOString().slice(0, 10);

const EMPTY = { title: "", category: "Machine maintenance", amount: "", date: todayISO(), notes: "" };

export default function Maintenance() {
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/expenses");
      setExpenses(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const resetForm = () => {
    setForm(EMPTY);
    setEditingId(null);
    setError("");
    setShowForm(false);
  };

  const openCreate = () => {
    setForm(EMPTY);
    setEditingId(null);
    setError("");
    setShowForm(true);
  };

  const openEdit = (ex) => {
    setEditingId(ex._id);
    setForm({
      title: ex.title || "",
      category: ex.category || "Other",
      amount: ex.amount ?? "",
      date: ex.date ? ex.date.slice(0, 10) : todayISO(),
      notes: ex.notes || "",
    });
    setError("");
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) return setError("Title is required.");
    if (form.amount === "" || Number(form.amount) < 0)
      return setError("Enter a valid amount.");
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editingId) {
        await api.put(`/expenses/${editingId}`, payload);
      } else {
        await api.post("/expenses", payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save expense.");
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this expense?")) return;
    await api.delete(`/expenses/${id}`);
    await load();
  };

  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="icon"><Icon name="receipt_long" /> Expenses</h1>
        {!showForm && (
          <button className="icon" onClick={openCreate}>
            <Icon name="add_circle" size={18} /> Add expense
          </button>
        )}
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={resetForm}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmit} style={{ display: "contents" }}>
              <div className="modal-head">
                <h3 className="icon">
                  <Icon name={editingId ? "edit" : "add_circle"} size={18} />{" "}
                  {editingId ? "Edit expense" : "Record an expense"}
                </h3>
                <button type="button" className="modal-close" aria-label="Close" onClick={resetForm}>
                  <Icon name="close" />
                </button>
              </div>
              {error && <div className="error">{error}</div>}
              <div className="grid-2">
                <label>
                  <span className="lbl">Title <span className="req">*</span></span>
                  <input
                    name="title"
                    placeholder="e.g. Autoclave annual service"
                    value={form.title}
                    onChange={handleChange}
                  />
                </label>
                <label>
                  Category
                  <select name="category" value={form.category} onChange={handleChange}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="lbl">Amount <span className="req">*</span></span>
                  <input
                    type="number"
                    name="amount"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 1500"
                    value={form.amount}
                    onKeyDown={(e) => {
                      if (["-", "+", "e", "E"].includes(e.key)) e.preventDefault();
                    }}
                    onChange={handleChange}
                  />
                </label>
                <label>
                  Date
                  <input type="date" name="date" value={form.date} onChange={handleChange} />
                </label>
              </div>
              <label>
                Notes
                <textarea name="notes" rows={2} value={form.notes} onChange={handleChange} />
              </label>
              <div className="row gap">
                <button type="submit" className="icon">
                  <Icon name="save" size={18} /> {editingId ? "Update expense" : "Save expense"}
                </button>
                <button type="button" className="btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="row gap" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 className="icon"><Icon name="receipt_long" /> Logged expenses</h2>
        <strong className="money">Total: {money(total)}</strong>
      </div>

      {loading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : expenses.length === 0 ? (
        <p className="muted">No expenses recorded yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Title</th>
              <th>Category</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e._id}>
                <td>{formatDate(e.date)}</td>
                <td>
                  {e.title}
                  {e.notes && <div className="muted" style={{ fontSize: 13 }}>{e.notes}</div>}
                </td>
                <td><span className="tag">{e.category || "Other"}</span></td>
                <td className="money">{money(e.amount)}</td>
                <td className="row gap" style={{ justifyContent: "flex-end" }}>
                  <button className="btn-secondary icon" onClick={() => openEdit(e)}>
                    <Icon name="edit" size={18} /> Edit
                  </button>
                  <button className="btn-danger-soft icon" onClick={() => remove(e._id)}>
                    <Icon name="delete" size={18} /> Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
