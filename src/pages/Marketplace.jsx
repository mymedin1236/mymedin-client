import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { formatDate, formatDateTime } from "../utils/date";
import Icon from "../components/Icon";
import { SkeletonCards } from "../components/Skeleton";

const STATUS_COLORS = {
  pending: "badge-pending",
  confirmed: "badge-info",
  shipped: "badge-info",
  delivered: "badge",
  cancelled: "badge-danger",
};

export default function Marketplace() {
  const [tab, setTab] = useState("browse");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState({}); // { productId: { product, quantity } }
  const [orders, setOrders] = useState([]);
  const [placing, setPlacing] = useState(false);
  const [message, setMessage] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(true);

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      const { data } = await api.get("/products", { params });
      setProducts(data);
    } finally {
      setLoadingProducts(false);
    }
  };
  const loadOrders = async () => {
    const { data } = await api.get("/orders");
    setOrders(data);
  };

  useEffect(() => {
    api.get("/products/categories").then((r) => setCategories(r.data)).catch(console.error);
    loadOrders().catch(console.error);
  }, []);

  useEffect(() => {
    loadProducts().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category]);

  const addToCart = (product) => {
    setCart((c) => {
      const existing = c[product._id];
      return {
        ...c,
        [product._id]: {
          product,
          quantity: existing ? existing.quantity + 1 : 1,
        },
      };
    });
  };
  const setQty = (id, qty) => {
    setCart((c) => {
      if (qty <= 0) {
        const next = { ...c };
        delete next[id];
        return next;
      }
      return { ...c, [id]: { ...c[id], quantity: qty } };
    });
  };

  const cartItems = Object.values(cart);
  const cartTotal = useMemo(
    () => cartItems.reduce((s, i) => s + i.product.price * i.quantity, 0),
    [cartItems]
  );

  const placeOrder = async () => {
    setPlacing(true);
    setMessage("");
    try {
      const items = cartItems.map((i) => ({
        product: i.product._id,
        quantity: i.quantity,
      }));
      const { data } = await api.post("/orders", { items });
      setCart({});
      await loadOrders();
      setMessage(
        `Order placed! ${data.length} order${data.length > 1 ? "s" : ""} created (one per vendor).`
      );
      setTab("orders");
    } catch (err) {
      setMessage(err.response?.data?.message || "Could not place order");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="page">
      <h1 className="icon">
        <Icon name="shopping_cart" /> Supplies
      </h1>

      <div className="tabs">
        <button
          className={`tab ${tab === "browse" ? "tab-active" : ""}`}
          onClick={() => setTab("browse")}
        >
          Browse
        </button>
        <button
          className={`tab ${tab === "orders" ? "tab-active" : ""}`}
          onClick={() => setTab("orders")}
        >
          My orders ({orders.length})
        </button>
      </div>

      {message && <div className="info-banner">{message}</div>}

      {tab === "browse" && (
        <div className="marketplace-layout">
          <div>
            <div className="row gap" style={{ flexWrap: "wrap", marginBottom: 12 }}>
              <input
                placeholder="Search supplies…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: 180 }}
              />
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {loadingProducts ? (
              <SkeletonCards count={6} />
            ) : products.length === 0 ? (
              <p className="muted">No products match.</p>
            ) : (
              <div className="dentist-grid">
                {products.map((p) => (
                  <div key={p._id} className="dentist-card" style={{ cursor: "default" }}>
                    <div className="row gap" style={{ justifyContent: "space-between" }}>
                      <strong>{p.name}</strong>
                    </div>
                    {p.category && <span className="tag">{p.category}</span>}
                    {p.description && <p className="clamp-2">{p.description}</p>}
                    <div className="muted" style={{ fontSize: 13 }}>
                      by {p.vendor?.companyName || p.vendor?.name}
                    </div>
                    <div
                      className="row gap"
                      style={{ justifyContent: "space-between", marginTop: 6 }}
                    >
                      <strong>
                        Rs {p.price.toFixed(2)}{" "}
                        <span className="muted" style={{ fontWeight: 400 }}>
                          / {p.unit}
                        </span>
                      </strong>
                      <button className="btn-secondary icon" onClick={() => addToCart(p)}>
                        <Icon name="add_shopping_cart" size={18} /> Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart */}
          <aside className="cart card">
            <h3 className="icon">
              <Icon name="shopping_cart" size={18} /> Cart ({cartItems.length})
            </h3>
            {cartItems.length === 0 ? (
              <p className="muted">Your cart is empty.</p>
            ) : (
              <>
                {cartItems.map(({ product, quantity }) => (
                  <div key={product._id} className="cart-row">
                    <div style={{ flex: 1 }}>
                      <div>{product.name}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        Rs {product.price.toFixed(2)} / {product.unit}
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={quantity}
                      onChange={(e) => setQty(product._id, parseInt(e.target.value, 10) || 0)}
                      style={{ width: 56 }}
                    />
                  </div>
                ))}
                <hr className="divider" />
                <div className="row gap" style={{ justifyContent: "space-between" }}>
                  <strong>Total</strong>
                  <strong>Rs {cartTotal.toFixed(2)}</strong>
                </div>
                <button onClick={placeOrder} disabled={placing}>
                  {placing ? "Placing…" : "Place order"}
                </button>
              </>
            )}
          </aside>
        </div>
      )}

      {tab === "orders" && (
        <>
          {orders.length === 0 ? (
            <p className="muted">You haven't placed any orders yet.</p>
          ) : (
            orders.map((o) => (
              <div key={o._id} className="card">
                <div className="row gap" style={{ justifyContent: "space-between" }}>
                  <div>
                    <strong>{o.vendor?.companyName || o.vendor?.name}</strong>
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
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
