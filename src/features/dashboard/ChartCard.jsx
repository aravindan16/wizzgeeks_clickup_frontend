import { useCardData } from './useCardData';
import CardFrame from './CardFrame';

/**
 * Chart cards (Line / Bar / Pie / Calculation) over the selected Lists' tasks.
 * Dependency-free — every chart is hand-rendered SVG.
 */
export default function ChartCard({ card, onRemove, onEdit, fill = false }) {
  const data = useCardData(card);
  let body;
  if (!data) body = <div style={s.msg}>Loading…</div>;
  else if (data.total === 0 && card.type !== 'calculation') body = <div style={s.msg}>No tasks in the selected Lists.</div>;
  else if (card.type === 'calculation') body = <Calculation data={data} />;
  else if (card.type === 'pie') body = <Pie data={data} />;
  else if (card.type === 'bar') body = <Bar data={data} />;
  else if (card.type === 'line') body = <Line data={data} />;
  else body = <div style={s.msg}>Unknown card type.</div>;

  return <CardFrame title={card.title} onRemove={onRemove} onEdit={onEdit} fill={fill}>{body}</CardFrame>;
}

/* ----------------------------------------------------------- Calculation */
function Calculation({ data }) {
  return (
    <div style={s.calcWrap}>
      <div style={s.calcNum}>{data.total.toLocaleString()}</div>
      <div style={s.calcLabel}>Total tasks</div>
    </div>
  );
}

/* ------------------------------------------------------------------- Pie */
function Pie({ data }) {
  const items = data.byStatus.filter((i) => i.count > 0);
  const total = items.reduce((s2, i) => s2 + i.count, 0);
  if (!total) return <div style={s.msg}>No tasks to chart.</div>;

  let arcs;
  if (items.length === 1) {
    arcs = null; // full ring rendered as two circles below
  } else {
    let a0 = -Math.PI / 2;
    arcs = items.map((it) => {
      const a1 = a0 + (it.count / total) * 2 * Math.PI;
      const path = donutArc(90, 90, 70, 44, a0, a1);
      a0 = a1;
      return { ...it, path };
    });
  }

  return (
    <div style={s.pieWrap}>
      <svg width={180} height={180} viewBox="0 0 180 180" style={{ flexShrink: 0 }}>
        {items.length === 1 ? (
          <>
            <circle cx={90} cy={90} r={70} fill={items[0].color} />
            <circle cx={90} cy={90} r={44} fill="var(--c-surface)" />
          </>
        ) : arcs.map((it) => <path key={it.key} d={it.path} fill={it.color} />)}
        <text x={90} y={86} textAnchor="middle" style={s.pieCenterNum}>{total}</text>
        <text x={90} y={104} textAnchor="middle" style={s.pieCenterLabel}>tasks</text>
      </svg>
      <div style={s.legend}>
        {items.map((it) => (
          <div key={it.key} style={s.legendRow}>
            <span style={{ ...s.dot, background: it.color }} />
            <span style={s.legendLabel}>{it.label}</span>
            <span style={s.legendVal}>{it.count} · {Math.round((it.count / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- Bar */
function Bar({ data }) {
  const items = data.byList;
  if (!items.length) return <div style={s.msg}>No lists selected.</div>;
  const max = Math.max(1, ...items.map((i) => i.total));
  const H = 150;
  return (
    <div style={s.barWrap}>
      <div style={s.bars}>
        {items.map((it, i) => {
          const h = Math.round((it.total / max) * H);
          const dh = Math.round((it.done / max) * H);
          return (
            <div key={i} style={s.barCol}>
              <div style={s.barVal}>{it.total}</div>
              <div style={{ ...s.barTotal, height: Math.max(h, 3) }} title={`${it.done}/${it.total} done`}>
                <div style={{ ...s.barDone, height: dh }} />
              </div>
              <div style={s.barName} title={it.name}>{it.name}</div>
            </div>
          );
        })}
      </div>
      <div style={s.barLegend}>
        <span style={s.legendRow}><span style={{ ...s.dot, background: 'var(--c-primary)' }} />Done</span>
        <span style={s.legendRow}><span style={{ ...s.dot, background: 'var(--c-primary-weak)' }} />Remaining</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Line */
function Line({ data }) {
  const pts = data.timeline;
  if (pts.length < 2) return <div style={s.msg}>Not enough dated tasks to chart a trend.</div>;
  const W = 520, H = 200, pad = 28;
  const maxV = Math.max(...pts.map((p) => p.value));
  const x = (i) => pad + (i * (W - 2 * pad)) / (pts.length - 1);
  const y = (v) => H - pad - (v / maxV) * (H - 2 * pad);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${H - pad} L${x(0).toFixed(1)},${H - pad} Z`;
  return (
    <div style={s.lineWrap}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxHeight: 240 }}>
        <path d={area} fill="var(--c-primary-weak)" opacity={0.5} />
        <path d={line} fill="none" stroke="var(--c-primary)" strokeWidth={2.5} strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r={2.6} fill="var(--c-primary)" />)}
      </svg>
      <div style={s.lineMeta}>Cumulative tasks created · {pts[pts.length - 1].value} total</div>
    </div>
  );
}

/* --------------------------------------------------------------- helpers */
function polar(cx, cy, r, a) { return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
function donutArc(cx, cy, R, r, a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, R, a0);
  const [x1, y1] = polar(cx, cy, R, a1);
  const [x2, y2] = polar(cx, cy, r, a1);
  const [x3, y3] = polar(cx, cy, r, a0);
  return `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${large} 0 ${x3},${y3} Z`;
}

const s = {
  msg: { padding: 28, textAlign: 'center', color: 'var(--c-muted)', fontSize: 14 },

  calcWrap: { padding: '32px 16px', minHeight: 140, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 4 },
  calcNum: { fontSize: 56, fontWeight: 800, color: 'var(--c-text-strong)', lineHeight: 1 },
  calcLabel: { fontSize: 13, color: 'var(--c-muted)', marginTop: 8 },
  calcRow: { display: 'flex', gap: 28 },
  stat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  statNum: { fontSize: 22, fontWeight: 700 },
  statLabel: { fontSize: 12, color: 'var(--c-muted)' },

  pieWrap: { display: 'flex', alignItems: 'center', gap: 24, padding: '18px 20px', flexWrap: 'wrap' },
  pieCenterNum: { fontSize: 22, fontWeight: 800, fill: 'var(--c-text-strong)' },
  pieCenterLabel: { fontSize: 11, fill: 'var(--c-muted)' },
  legend: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180, flex: 1 },
  legendRow: { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--c-text)' },
  legendLabel: { flex: 1 },
  legendVal: { color: 'var(--c-muted)', fontSize: 12.5 },
  dot: { width: 10, height: 10, borderRadius: 3, display: 'inline-block', flexShrink: 0 },

  barWrap: { padding: '18px 20px' },
  bars: { display: 'flex', alignItems: 'flex-end', gap: 18, height: 190, overflowX: 'auto', paddingBottom: 4 },
  barCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 56, height: '100%', justifyContent: 'flex-end' },
  barVal: { fontSize: 12, fontWeight: 700, color: 'var(--c-text-strong)' },
  barTotal: { width: 34, background: 'var(--c-primary-weak)', borderRadius: '6px 6px 0 0',
    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden' },
  barDone: { width: '100%', background: 'var(--c-primary)' },
  barName: { fontSize: 11.5, color: 'var(--c-muted)', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' },
  barLegend: { display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' },

  lineWrap: { padding: '16px 16px 12px' },
  lineMeta: { fontSize: 12.5, color: 'var(--c-muted)', textAlign: 'center', marginTop: 6 },
};
