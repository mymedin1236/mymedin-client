// Reusable shimmering skeleton placeholders for content that is still loading.

export function Skeleton({ width = "100%", height = 14, radius = 8, style }) {
  return (
    <span
      className="skeleton"
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

// A row of stat-card placeholders (matches the .stats grid)
export function SkeletonStats({ count = 4 }) {
  return (
    <div className="stats">
      {Array.from({ length: count }).map((_, i) => (
        <div className="stat-card" key={i}>
          <Skeleton width={44} height={44} radius={12} />
          <Skeleton width={64} height={24} style={{ marginTop: 8 }} />
          <Skeleton width={72} height={10} style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}

// A table placeholder
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <table className="table" style={{ marginTop: 16 }}>
      <thead>
        <tr>
          {Array.from({ length: cols }).map((_, i) => (
            <th key={i}>
              <Skeleton width={70} height={10} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <td key={c}>
                <Skeleton width={c === 0 ? "60%" : "80%"} height={12} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// A grid of card placeholders (matches .doctor-grid)
export function SkeletonCards({ count = 6 }) {
  return (
    <div className="doctor-grid" style={{ marginTop: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div className="doctor-card" key={i} style={{ cursor: "default" }}>
          <Skeleton width="65%" height={18} />
          <Skeleton width="40%" height={12} style={{ marginTop: 4 }} />
          <Skeleton width="90%" height={12} style={{ marginTop: 10 }} />
          <Skeleton width="75%" height={12} style={{ marginTop: 6 }} />
        </div>
      ))}
    </div>
  );
}
