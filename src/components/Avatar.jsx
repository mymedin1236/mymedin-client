import Icon from "./Icon";

// Round profile photo with a graceful fallback (the person's initial, then a
// generic icon). `size` is the diameter in px.
export default function Avatar({ src, name = "", size = 48 }) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {src ? (
        <img src={src} alt={name || "Profile photo"} />
      ) : initial ? (
        initial
      ) : (
        <Icon name="person" size={Math.round(size * 0.6)} />
      )}
    </span>
  );
}
