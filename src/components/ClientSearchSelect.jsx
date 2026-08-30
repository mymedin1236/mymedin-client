import { useState } from "react";
import Icon from "./Icon";

// Searchable patient picker — type a name / phone / email to filter, instead of
// scrolling a long <select>. `value` is the selected client id.
export default function ClientSearchSelect({
  clients = [],
  value,
  onChange,
  disabled,
  placeholder = "Search patient by name or phone…",
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = clients.find((c) => c._id === value) || null;

  // When editing an existing appointment the patient is fixed — just show it.
  if (disabled) {
    return <input value={selected ? selected.name : ""} disabled />;
  }

  const q = query.trim().toLowerCase();
  const results = (q
    ? clients.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
      )
    : clients
  ).slice(0, 50);

  const pick = (c) => {
    onChange(c._id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="cs-select">
      <div className="cs-inputwrap">
        <Icon name="search" size={18} className="cs-icon" />
        <input
          type="text"
          className="cs-input"
          placeholder={placeholder}
          value={open ? query : selected ? selected.name : ""}
          onFocus={() => { setQuery(""); setOpen(true); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          autoComplete="off"
        />
        {selected && !open && (
          <button
            type="button"
            className="cs-clear"
            aria-label="Clear selection"
            onClick={() => { onChange(""); setQuery(""); }}
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {open && (
        <>
          <div className="cs-backdrop" onClick={() => setOpen(false)} />
          <div className="cs-list">
            {results.length === 0 ? (
              <div className="cs-empty">No patients found</div>
            ) : (
              results.map((c) => (
                <button
                  type="button"
                  key={c._id}
                  className={`cs-item${c._id === value ? " selected" : ""}`}
                  // Keep focus on the input during the click. Without this, when
                  // this widget sits inside a <label> the label forwards a click
                  // to the input, refocusing it and reopening the list — making
                  // the selection appear to fail.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(c)}
                >
                  <span className="cs-name">{c.name}</span>
                  <span className="cs-sub">{c.phone || c.email || (c.managed ? "Child" : "")}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
