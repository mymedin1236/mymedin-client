// Thin wrapper around Google Material Symbols (Outlined).
// Usage: <Icon name="calendar_month" /> or <Icon name="group" size={32} />
export default function Icon({ name, size, className = "", style, ...rest }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`.trim()}
      style={size ? { fontSize: size, ...style } : style}
      aria-hidden="true"
      {...rest}
    >
      {name}
    </span>
  );
}
