import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { formatDate } from "../utils/date";
import Icon from "../components/Icon";

const money = (n) => `Rs ${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const PERIODS = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

const CARDS = [
  { key: "collected", label: "Collected", icon: "payments", cls: "earned" },
  { key: "expenses", label: "Expenses", icon: "shopping_cart_checkout", cls: "spent" },
  { key: "outstanding", label: "Outstanding", icon: "pending_actions", cls: "pending" },
];

export default function Finances() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("day");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false); // true when the fetch failed (e.g. slow connection)
  const [detail, setDetail] = useState(null); // "collected" | "expenses" | "outstanding"

  const load = () => {
    setLoadError(false);
    return api
      .get("/finances/period", { params: { period, offset }, skipLoader: true })
      .then((r) => setData(r.data))
      .catch(() => {
        setData(null);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  };

  const refresh = () => {
    setLoading(true);
    load();
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, offset]);

  const markPaid = async (id) => {
    await api.put(`/treatments/${id}`, { paid: true });
    await load();
  };

  // Open the patient's full treatment + payment record for a finance entry.
  const openRecord = (clientId) => {
    if (!clientId) return;
    setDetail(null);
    navigate(`/clients/${clientId}`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="icon"><Icon name="payments" /> Finances</h1>
        <button type="button" className="btn-secondary icon" onClick={refresh} disabled={loading}>
          <Icon name="refresh" size={18} /> {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="period-toggle">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={period === p.key ? "active" : ""}
            onClick={() => { setPeriod(p.key); setOffset(0); }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="period-nav" style={{ maxWidth: 460, marginTop: 12 }}>
        <button type="button" className="icon" aria-label="Previous" onClick={() => setOffset((o) => o + 1)}>
          <Icon name="chevron_left" />
        </button>
        <span className="period-label">
          {data ? data.label : "…"}
          {offset === 0 && (
            <span className="muted">
              {" · "}
              {period === "day" ? "today" : period === "week" ? "this week" : period === "month" ? "this month" : "this year"}
            </span>
          )}
        </span>
        <button
          type="button"
          className="icon"
          aria-label="Next"
          disabled={offset === 0}
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
        >
          <Icon name="chevron_right" />
        </button>
      </div>

      {loading && !data ? (
        <p className="muted" style={{ margin: "20px 0" }}>Loading finances…</p>
      ) : loadError && !data ? (
        <div className="card fin-error">
          <Icon name="cloud_off" size={28} />
          <p style={{ margin: 0 }}>
            Couldn't load your finances — the connection may be slow. Nothing was lost; just try again.
          </p>
          <button type="button" className="icon" onClick={refresh} disabled={loading}>
            <Icon name="refresh" size={18} /> {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      ) : (
        <div className="fin-cards">
          {CARDS.map((c) => {
            const section = data?.[c.key];
            const count = section?.items?.length || 0;
            return (
              <button
                key={c.key}
                type="button"
                className={`fin-card ${c.cls}`}
                onClick={() => count && setDetail(c.key)}
                disabled={loading}
              >
                <Icon name={c.icon} size={26} />
                <div className="fin-card-value">{money(section?.total || 0)}</div>
                <div className="fin-card-label">{c.label}</div>
                <div className="fin-card-meta">
                  {count} {count === 1 ? "item" : "items"}{count ? " · tap for details" : ""}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {detail && data && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="icon">
                <Icon name={CARDS.find((c) => c.key === detail).icon} size={18} />{" "}
                {CARDS.find((c) => c.key === detail).label} · {data.label}
              </h3>
              <button type="button" className="modal-close" aria-label="Close" onClick={() => setDetail(null)}>
                <Icon name="close" />
              </button>
            </div>

            <div className="fin-detail-total">
              <span className="muted">
                {detail === "collected" ? "Grand total (cash + online)" : `Total ${detail}`} ·{" "}
                {data[detail].items.length}{" "}
                {data[detail].items.length === 1 ? "entry" : "entries"}
              </span>
              <strong>{money(data[detail].total)}</strong>
            </div>

            {data[detail].items.length === 0 ? (
              <p className="muted">Nothing in this period.</p>
            ) : (
              <div className="fin-detail-list">
                {detail === "collected" &&
                  [
                    { key: "cash", label: "Cash", icon: "payments" },
                    { key: "online", label: "Online", icon: "account_balance" },
                  ].map((g) => {
                    const grp = data.collected[g.key] || { total: 0, items: [] };
                    return (
                      <div key={g.key} className="fin-method-group">
                        <div className="fin-method-head">
                          <span className="icon"><Icon name={g.icon} size={16} /> Collected via {g.label}</span>
                          <strong>{money(grp.total)}</strong>
                        </div>
                        {grp.items.length === 0 ? (
                          <p className="muted fin-method-empty">No {g.label.toLowerCase()} payments in this period.</p>
                        ) : (
                          grp.items.map((it, i) => (
                            <div
                              key={i}
                              className={`fin-detail-row${it.clientId ? " clickable" : ""}`}
                              onClick={it.clientId ? () => openRecord(it.clientId) : undefined}
                              title={it.clientId ? "View patient record" : undefined}
                            >
                              <div className="fin-detail-main">
                                <strong>{it.client || "Patient"}</strong>
                                {it.procedure && <span className="muted"> · {it.procedure}</span>}
                                <div className="fin-detail-sub muted">
                                  {formatDate(it.date)}{it.note ? ` · ${it.note}` : ""}
                                </div>
                              </div>
                              <div className="fin-detail-right">
                                <span className="fin-amt earned">{money(it.amount)}</span>
                              </div>
                              {it.clientId && <Icon name="chevron_right" size={18} className="fin-detail-go" />}
                            </div>
                          ))
                        )}
                      </div>
                    );
                  })}

                {detail === "expenses" &&
                  data.expenses.items.map((it, i) => (
                    <div key={i} className="fin-detail-row">
                      <div className="fin-detail-main">
                        <strong>{it.title}</strong>
                        {it.category && <span className="muted"> · {it.category}</span>}
                        <div className="fin-detail-sub muted">{formatDate(it.date)}</div>
                      </div>
                      <div className="fin-detail-right">
                        <span className="fin-amt spent">{money(it.amount)}</span>
                        <span className="tag">{it.kind === "supply" ? "Supplies" : "Maintenance"}</span>
                      </div>
                    </div>
                  ))}

                {detail === "outstanding" &&
                  data.outstanding.items.map((it) => (
                    <div
                      key={it._id}
                      className={`fin-detail-row${it.clientId ? " clickable" : ""}`}
                      onClick={it.clientId ? () => openRecord(it.clientId) : undefined}
                      title={it.clientId ? "View patient record" : undefined}
                    >
                      <div className="fin-detail-main">
                        <strong>{it.client || "Patient"}</strong>
                        {it.procedure && <span className="muted"> · {it.procedure}</span>}
                        <div className="fin-detail-sub muted">
                          {formatDate(it.date)} · balance {money(it.balance)} of {money(it.cost)}
                        </div>
                      </div>
                      <div className="fin-detail-right">
                        <span className="fin-amt pending">{money(it.balance)}</span>
                        <button
                          className="btn-secondary icon"
                          onClick={(e) => { e.stopPropagation(); markPaid(it._id); }}
                        >
                          <Icon name="check_circle" size={18} /> Mark paid
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
