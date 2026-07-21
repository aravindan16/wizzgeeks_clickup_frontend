import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useCardData } from './useCardData';
import CardFrame from './CardFrame';

/**
 * Chart cards (Line / Bar / Pie / Calculation) over the selected Lists' tasks.
 * Dependency-free — every chart is hand-rendered SVG.
 */
export default function ChartCard({ card, onRemove, onEdit, onExpand, fill = false }) {
  const data = useCardData(card);
  let body;
  if (!data) body = <div style={s.msg}>Loading…</div>;
  else if (data.total === 0 && card.type !== 'calculation') body = <div style={s.msg}>No tasks in the selected Lists.</div>;
  else if (card.type === 'calculation') body = <Calculation data={data} />;
  else if (card.type === 'pie') body = <Pie data={data} xMeasure={card.xMeasure} xShow={card.xShow} />;
  else if (card.type === 'bar') body = <Bar data={data} xMeasure={card.xMeasure} xShow={card.xShow} />;
  else if (card.type === 'line') body = <Line data={data} />;
  else body = <div style={s.msg}>Unknown card type.</div>;

  return <CardFrame title={card.title} onRemove={onRemove} onEdit={onEdit} onExpand={onExpand} fill={fill}>{body}</CardFrame>;
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

// Distinct, colourful palette (each series/segment gets its own colour) — cycles
// if there are more categories than colours.
const CHART_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899',
  '#8b5cf6', '#14b8a6', '#f97316', '#3b82f6', '#a855f7', '#22c55e',
];
const chartColor = (i) => CHART_COLORS[i % CHART_COLORS.length];

// Build the chart series [{key,label,count,color}] for the chosen X-axis measure,
// optionally filtered to the categories in `xShow` (empty/undefined = show all).
// Each category gets a distinct colour from the palette.
function series(data, xMeasure, xShow) {
  let arr;
  if (xMeasure === 'priority') arr = data.byPriority || [];
  else if (xMeasure === 'list') arr = (data.byList || []).map((l) => ({ key: l.name, label: l.name, count: l.total }));
  else arr = data.byStatusGroup || []; // default: status group (Not started/Active/Done/Closed)
  if (Array.isArray(xShow) && xShow.length) arr = arr.filter((a) => xShow.includes(a.key));
  return arr.map((a, i) => ({ ...a, color: chartColor(i) }));
}
const niceCeil = (v) => {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return m * p;
};

/* ------------------------------------------------------------------- Pie */
function Pie({ data, xMeasure, xShow }) {
  const items = series(data, xMeasure, xShow).filter((i) => i.count > 0);
  const [hover, setHover] = useState(null); // { key, cx, cy }
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

  const pct = (c) => Math.round((c / total) * 100);
  const track = (key) => (e) => setHover({ key, cx: e.clientX, cy: e.clientY });
  const dim = (key) => hover && hover.key !== key ? 0.35 : 1;
  const hv = hover ? items.find((i) => i.key === hover.key) : null;

  return (
    <div style={s.pieWrap}>
      <svg width={180} height={180} viewBox="0 0 180 180" style={{ flexShrink: 0 }}
        onMouseLeave={() => setHover(null)}>
        {items.length === 1 ? (
          <>
            <circle cx={90} cy={90} r={70} fill={items[0].color} onMouseMove={track(items[0].key)} style={{ cursor: 'default' }} />
            <circle cx={90} cy={90} r={44} fill="var(--c-surface)" pointerEvents="none" />
          </>
        ) : arcs.map((it) => (
          <path key={it.key} d={it.path} fill={it.color} opacity={dim(it.key)}
            onMouseMove={track(it.key)} style={{ cursor: 'default', transition: 'opacity .12s' }} />
        ))}
        <text x={90} y={86} textAnchor="middle" style={s.pieCenterNum} pointerEvents="none">{hv ? hv.count : total}</text>
        <text x={90} y={104} textAnchor="middle" style={s.pieCenterLabel} pointerEvents="none">{hv ? `${pct(hv.count)}%` : 'tasks'}</text>
      </svg>
      <div style={s.legend}>
        {items.map((it) => (
          <div key={it.key} style={{ ...s.legendRow, opacity: dim(it.key) }}
            onMouseEnter={(e) => setHover({ key: it.key, cx: e.clientX, cy: e.clientY })} onMouseLeave={() => setHover(null)}>
            <span style={{ ...s.dot, background: it.color }} />
            <span style={s.legendLabel}>{it.label}</span>
            <span style={s.legendVal}>{it.count} · {pct(it.count)}%</span>
          </div>
        ))}
      </div>
      {hv && createPortal(
        <div style={{ ...s.lineTip, left: hover.cx, top: hover.cy - 12 }}>
          <div style={s.lineTipVal}>{hv.count} task{hv.count === 1 ? '' : 's'} · {pct(hv.count)}%</div>
          <div style={s.lineTipDate}>{hv.label}</div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- Bar */
function Bar({ data, xMeasure, xShow }) {
  const items = series(data, xMeasure, xShow);
  const [hover, setHover] = useState(null); // { i, cx, cy } client coords
  const svgRef = useRef(null);
  if (!items.length) return <div style={s.msg}>No data to chart.</div>;
  const maxV = Math.max(1, ...items.map((i) => i.count));
  const niceMax = niceCeil(maxV);
  const W = 560, H = 300, padL = 34, padR = 12, padT = 14, padB = 34;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const band = plotW / items.length;
  const barW = Math.min(56, band * 0.55);
  const ticks = 5;
  const yOf = (v) => padT + plotH - (v / niceMax) * plotH;
  // Anchor the tooltip to the hovered bar's top-centre, in client coords for the portal.
  const showTip = (i) => (e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = padL + band * i + band / 2;
    const bh = (items[i].count / niceMax) * plotH;
    setHover({ i, cx: rect.left + (cx / W) * rect.width, cy: rect.top + ((padT + plotH - bh) / H) * rect.height });
  };
  const hv = hover ? items[hover.i] : null;
  return (
    <div style={s.barWrap}>
      <div style={s.axisTitle}>Tasks</div>
      <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxHeight: 360, overflow: 'visible' }}>
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const v = (niceMax * i) / ticks;
          const yy = yOf(v);
          return (
            <g key={i}>
              <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="var(--c-border-2)" strokeWidth={1} />
              <text x={padL - 6} y={yy + 4} textAnchor="end" fontSize={11} fill="var(--c-muted)">{Math.round(v)}</text>
            </g>
          );
        })}
        {items.map((it, i) => {
          const cx = padL + band * i + band / 2;
          const bh = (it.count / niceMax) * plotH;
          return (
            <g key={it.key}>
              {/* full-height hover zone so the tooltip triggers over the whole column */}
              <rect x={cx - band / 2} y={padT} width={band} height={plotH} fill="transparent"
                onMouseEnter={showTip(i)} onMouseMove={showTip(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'default' }} />
              <rect x={cx - barW / 2} y={padT + plotH - bh} width={barW} height={Math.max(bh, 0)} rx={4}
                fill={it.color} opacity={hover && hover.i !== i ? 0.55 : 1} pointerEvents="none" />
              <text x={cx} y={H - padB + 16} textAnchor="middle" fontSize={11} fill="var(--c-muted)" pointerEvents="none">{it.label}</text>
            </g>
          );
        })}
      </svg>
      {hv && createPortal(
        <div style={{ ...s.lineTip, left: hover.cx, top: hover.cy }}>
          <div style={s.lineTipVal}>{hv.count} task{hv.count === 1 ? '' : 's'}</div>
          <div style={s.lineTipDate}>{hv.label}</div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Line */
const fmtDate = (d) => {
  const [y, m, day] = String(d).split('-').map(Number);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!m || !day) return String(d);
  return `${MON[m - 1]} ${day}`;
};
function Line({ data }) {
  const pts = data.timeline;
  const [hover, setHover] = useState(null); // { i, cx, cy } in client (fixed) coords
  const svgRef = useRef(null);
  if (pts.length < 2) return <div style={s.msg}>Not enough dated tasks to chart a trend.</div>;
  const W = 560, H = 300, padL = 40, padR = 16, padT = 18, padB = 46;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const maxV = Math.max(...pts.map((p) => p.value));
  const niceMax = niceCeil(maxV);
  const ticks = 5;
  const x = (i) => padL + (i * plotW) / (pts.length - 1);
  const y = (v) => padT + plotH - (v / niceMax) * plotH;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${padT + plotH} L${x(0).toFixed(1)},${padT + plotH} Z`;
  const color = chartColor(0);
  // Show at most ~6 evenly spaced date labels so the axis never crowds.
  const step = Math.max(1, Math.ceil(pts.length / 6));
  const xLabels = pts.map((p, i) => ({ p, i })).filter(({ i }) => i % step === 0 || i === pts.length - 1);

  // Map the cursor to the nearest data point and record its pixel position for the tooltip.
  const onMove = (e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const vx = ((e.clientX - rect.left) / rect.width) * W; // pixel → viewBox x
    let i = Math.round(((vx - padL) / plotW) * (pts.length - 1));
    i = Math.max(0, Math.min(pts.length - 1, i));
    // anchor the tooltip to the data point, in client coords (for the fixed-position portal)
    setHover({ i, cx: rect.left + (x(i) / W) * rect.width, cy: rect.top + (y(pts[i].value) / H) * rect.height });
  };
  const hv = hover ? pts[hover.i] : null;

  return (
    <div style={s.lineWrap}>
      <div style={s.axisTitle}>Total tasks (running total)</div>
      <div style={{ position: 'relative' }}>
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxHeight: 340, overflow: 'visible', display: 'block' }}
          onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          {/* horizontal gridlines + Y-axis value labels */}
          {Array.from({ length: ticks + 1 }).map((_, i) => {
            const v = (niceMax * i) / ticks;
            const yy = y(v);
            return (
              <g key={i}>
                <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="var(--c-border-2)" strokeWidth={1} />
                <text x={padL - 8} y={yy + 4} textAnchor="end" fontSize={11} fill="var(--c-muted)">{Math.round(v)}</text>
              </g>
            );
          })}
          <path d={area} fill={color} opacity={0.12} />
          <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
          {/* hover guide line + emphasised point */}
          {hv && (
            <g>
              <line x1={x(hover.i)} y1={padT} x2={x(hover.i)} y2={padT + plotH} stroke={color} strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
              <circle cx={x(hover.i)} cy={y(hv.value)} r={5.5} fill={color} stroke="var(--c-surface)" strokeWidth={2} />
            </g>
          )}
          {pts.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(p.value)} r={3.2} fill="var(--c-surface)" stroke={color} strokeWidth={2} />
          ))}
          {/* X-axis date labels */}
          {xLabels.map(({ p, i }) => (
            <text key={i} x={x(i)} y={padT + plotH + 20} textAnchor="middle" fontSize={11} fill="var(--c-muted)">{fmtDate(p.date)}</text>
          ))}
        </svg>
        {hv && createPortal(
          <div style={{ ...s.lineTip, left: hover.cx, top: hover.cy }}>
            <div style={s.lineTipVal}>{hv.value} task{hv.value === 1 ? '' : 's'}</div>
            <div style={s.lineTipDate}>{fmtDate(hv.date)}</div>
          </div>,
          document.body,
        )}
      </div>
      <div style={s.lineMeta}>
        {pts[pts.length - 1].value} tasks created by {fmtDate(pts[pts.length - 1].date)} · hover the chart to see each day
      </div>
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
  calcNum: { fontSize: 56, fontWeight: 800, color: CHART_COLORS[0], lineHeight: 1 },
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

  barWrap: { padding: '14px 16px' },
  axisTitle: { fontSize: 11, color: 'var(--c-muted)', marginBottom: 2 },
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
  lineTip: { position: 'fixed', transform: 'translate(-50%, -125%)', pointerEvents: 'none',
    background: 'var(--c-text-strong)', color: 'var(--c-surface)', padding: '5px 9px', borderRadius: 7,
    fontSize: 12, lineHeight: 1.25, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,.22)', zIndex: 9999 },
  lineTipVal: { fontWeight: 700 },
  lineTipDate: { opacity: 0.75, fontSize: 11 },
};
