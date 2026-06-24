/**
 * Minimal SVG donut chart.
 * data: [{ label, value, color }]
 */
export default function DonutChart({ data, size = 180, thickness = 22 }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  let offset = 0;
  const segments = total > 0 ? data.filter((d) => d.value > 0).map((d) => {
    const len = (d.value / total) * c;
    const seg = { ...d, dasharray: `${len} ${c - len}`, dashoffset: -offset };
    offset += len;
    return seg;
  }) : [];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef2f7" strokeWidth={thickness} />
        {segments.map((seg, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={seg.dasharray} strokeDashoffset={seg.dashoffset}
            transform={`rotate(-90 ${cx} ${cy})`} />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="26" fontWeight="700" fill="#111827">{total}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="11" fill="#6b7280">Total work items</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.filter((d) => d.value > 0).map((d) => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: d.color, display: 'inline-block' }} />
            {d.label}: {d.value}
          </div>
        ))}
        {total === 0 && <span style={{ color: '#6b7280', fontSize: 13 }}>No work items</span>}
      </div>
    </div>
  );
}
