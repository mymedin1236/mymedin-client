import { useEffect, useState } from "react";
import api from "../api/axios";
import { formatDate, formatDateTime } from "../utils/date";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";

const STATUS_FLOW = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
const STATUS_COLORS = {
  pending: "badge-pending",
  confirmed: "badge-info",
  shipped: "badge-info",
  delivered: "badge",
  cancelled: "badge-danger",
};

const EMPTY = { name: "", category: "", price: "", unit: "each", stock: "", description: "" };

export default function VendorDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("products");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const loadProducts = async () => {
    const { data } = await api.get("/products", { params: { mine: true } });
    setProducts(data);
  };
  const loadOrders = async () => {
    const { data } = await api.get("/orders");
    setOrders(data);
  };

  useEffect(() => {
    loadProducts().catch(console.error);
    loadOrders().catch(console.error);
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const resetForm = () => {
    setForm(EMPTY);
    setEditingId(null);
  };

  const submitProduct = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        stock: form.stock === "" ? 0 : Number(form.stock),
      };
      if (editingId) await api.put(`/products/${editingId}`, payload);
      else await api.post("/products", payload);
      resetForm();
      await loadProducts();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save product");
    }
  };

  const editProduct = (p) => {
    setEditingId(p._id);
    setForm({
      name: p.name || "",
      category: p.category || "",
      price: p.price ?? "",
      unit: p.unit || "each",
      stock: p.stock ?? "",
      description: p.description || "",
    });
    setTab("products");
  };

  const deleteProduct = async (id) => {
    if (!confirm("Delete this product?")) return;
    await api.delete(`/products/${id}`);
    await loadProducts();
  };

  const updateStatus = async (id, status) => {
    await api.patch(`/orders/${id}/status`, { status });
    await loadOrders();
  };

  return (
    <div className="page">
      <h1 className="icon">
        <Icon name="storefront" /> {user.companyName || user.name}
      </h1>

      <div className="tabs">
        <button
          className={`tab ${tab === "products" ? "tab-active" : ""}`}
          onClick={() => setTab("products")}
        >
          My products ({products.length})
        </button>
        <button
          className={`tab ${tab === "orders" ? "tab-active" : ""}`}
          onClick={() => setTab("orders")}
        >
          Incoming orders ({orders.length})
        </button>
      </div>

      {tab === "products" && (
        <>
          <form className="card" onSubmit={submitProduct}>
            <h3 className="icon">
              <Icon name={editingId ? "edit" : "add_box"} size={18} />
              {editingId ? "Edit product" : "Add a product"}
            </h3>
            {error && <div className="error">{error}</div>}
            <div className="grid-2">
              <label>
                Name
                <input name="name" required value={form.name} onChange={handleChange} />
              </label>
              <label>
                Category
                <input
                  name="category"
                  placeholder="e.g. Instruments"
                  value={form.category}
                  onChange={handleChange}
                />
              </label>
            </div>
            <div className="grid-2">
              <label>
                Price
                <input
                  type="number"
                  name="price"
                  min="0"
                  step="0.01"
                  required
                  value={form.price}
                  onChange={handleChange}
                />
              </label>
              <label>
                Unit
                <input
                  name="unit"
                  placeholder="each / box / pack"
                  value={form.unit}
                  onChange={handleChange}
                />
              </label>
            </div>
            <label>
              Stock
              <input
                type="number"
                name="stock"
                min="0"
                value={form.stock}
                onChange={handleChange}
              />
            </label>
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
              <button type="submit">{editingId ? "Save changes" : "Add product"}</button>
              {editingId && (
                <button type="button" className="btn-secondary" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>

          {products.length === 0 ? (
            <p className="muted">No products yet — add your first one above.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p._id}>
                    <td>{p.name}</td>
                    <td>{p.category || "—"}</td>
                    <td>
                      Rs {p.price.toFixed(2)} <span className="muted">/ {p.unit}</span>
                    </td>
                    <td>{p.stock}</td>
                    <td>
                      <div className="row gap">
                        <button className="btn-link icon" onClick={() => editProduct(p)}>
                          <Icon name="edit" size={18} />
                        </button>
                        <button
                          className="btn-link icon"
                          onClick={() => deleteProduct(p._id)}
                        >
                          <Icon name="delete" size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {tab === "orders" && (
        <>
          {orders.length === 0 ? (
            <p className="muted">No orders yet.</p>
          ) : (
            orders.map((o) => (
              <div key={o._id} className="card">
                <div className="row gap" style={{ justifyContent: "space-between" }}>
                  <div>
                    <strong>Dr. {o.doctor?.name}</strong>
                    {o.doctor?.clinicName && (
                      <span className="muted"> · {o.doctor.clinicName}</span>
                    )}
                    <div className="muted" style={{ fontSize: 13 }}>
                      {formatDateTime(o.createdAt)}
                    </div>
                  </div>
                  <span className={STATUS_COLORS[o.status] || "badge"}>{o.status}</span>
                </div>
                <table className="table" style={{ marginTop: 8 }}>
                  <tbody>
                    {o.items.map((it, i) => (
                      <tr key={i}>
                        <td>{it.name}</td>
                        <td className="muted">×{it.quantity}</td>
                        <td>Rs {(it.price * it.quantity).toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={2}>
                        <strong>Total</strong>
                      </td>
                      <td>
                        <strong>Rs {o.total.toFixed(2)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <label style={{ maxWidth: 220 }}>
                  Update status
                  <select
                    value={o.status}
                    onChange={(e) => updateStatus(o._id, e.target.value)}
                  >
                    {STATUS_FLOW.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
