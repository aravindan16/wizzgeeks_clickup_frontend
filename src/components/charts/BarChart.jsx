/**
 * Minimal dependency-free SVG bar chart.
 * data: [{ label, value }]
 */
export default function BarChart({ data, color = '#111827', height = 160, suffix = '' }) {
  if (!data || data.length === 0) return <p style={{ color: '#6b7280' }}>No data</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = 100 / data.length;

  return (
    <svg viewBox={`0 0 100 ${height / 2}`} preserveAspectRatio="none"
      style={{ width: '100%', height, overflow: 'visible' }}>
      {data.map((d, i) => {
        const h = (d.value / max) * (height / 2 - 14);
        const x = i * barW + barW * 0.15;
        const w = barW * 0.7;
        const y = height / 2 - h - 8;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={Math.max(0, h)} rx="1" fill={color} />
            <text x={x + w / 2} y={y - 1.5} fontSize="3" textAnchor="middle" fill="#374151">
              {d.value}{suffix}
            </text>
            <text x={x + w / 2} y={height / 2 - 2} fontSize="3" textAnchor="middle" fill="#6b7280">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
