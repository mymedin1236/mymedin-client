import { useMemo, useState } from "react";

// A type-ahead combobox for the treatment procedure: type freely AND pick from
// common procedures. Uses a custom dropdown (not a native <datalist>, which is
// unreliable on mobile — iOS Safari especially). Suggestions filter as you type;
// a custom procedure not in the list is perfectly fine.
export default function ProcedureInput({
  value = "",
  onChange,
  options = [],
  required,
  placeholder = "e.g. Root Canal Treatment",
}) {
  const [open, setOpen] = useState(false);

  const q = value.trim().toLowerCase();
  const matches = useMemo(() => {
    const list = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
    // Hide the list when the text already exactly equals the only match.
    if (list.length === 1 && list[0].toLowerCase() === q) return [];
    return list.slice(0, 50);
  }, [q, options]);

  const pick = (o) => {
    onChange(o);
    setOpen(false);
  };

  return (
    <div className="cs-select">
      <input
        type="text"
        className="combo-input"
        required={required}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && matches.length > 0 && (
        <>
          <div className="cs-backdrop" onClick={() => setOpen(false)} />
          <div className="cs-list">
            {matches.map((o) => (
              <button
                type="button"
                key={o}
                className="cs-item"
                // Keep focus on the input during the tap so the surrounding
                // <label> can't forward the click and reopen/clear the list.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
              >
                <span className="cs-name">{o}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
