import Icon from "./Icon";

// Display a rating (read-only) or let the user pick one (interactive when onChange given).
export default function StarRating({ value = 0, onChange, size = 20 }) {
  const interactive = typeof onChange === "function";
  const stars = [1, 2, 3, 4, 5];

  return (
    <span className="star-rating" role={interactive ? "radiogroup" : undefined}>
      {stars.map((n) => {
        const filled = n <= Math.round(value);
        return (
          <Icon
            key={n}
            name="star"
            size={size}
            className={`star ${filled ? "filled" : ""} ${interactive ? "clickable" : ""}`}
            style={{ fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0" }}
            onClick={interactive ? () => onChange(n) : undefined}
            role={interactive ? "radio" : undefined}
            aria-checked={interactive ? n === value : undefined}
          />
        );
      })}
    </span>
  );
}
