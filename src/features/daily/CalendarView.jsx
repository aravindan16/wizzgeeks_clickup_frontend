import { useEffect, useMemo, useState } from 'react';
import { dailyApi } from './dailyApi';

/**
 * Month calendar showing which days have a submitted update and total hours.
 * Clicking a day with an update surfaces its details below.
 */
export default function CalendarView() {
  const [ref, setRef] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [updates, setUpdates] = useState([]);
  const [selected, setSelected] = useState(null);

  const monthStart = useMemo(() => new Date(ref.y, ref.m, 1), [ref]);
  const monthEnd = useMemo(() => new Date(ref.y, ref.m + 1, 0), [ref]);

  useEffect(() => {
    const fmt = (d) => d.toISOString().slice(0, 10);
    dailyApi.mine({ date_from: fmt(monthStart), date_to: fmt(monthEnd), limit: 200 })
      .then((d) => setUpdates(d.items)).catch(() => setUpdates([]));
  }, [monthStart, monthEnd]);

  const byDate = useMemo(() => {
    const map = {};
    updates.forEach((u) => { map[u.date] = u; });
    return map;
  }, [updates]);

  const daysInMonth = monthEnd.getDate();
  const firstWeekday = monthStart.getDay();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dateStr = (d) => `${ref.y}-${String(ref.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const shift = (delta) => setRef((r) => {
    const nm = r.m + delta;
    return { y: r.y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
  });

  const monthName = monthStart.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div style={s.head}>
        <button style={s.nav} onClick={() => shift(-1)}>‹</button>
        <strong>{monthName}</strong>
        <button style={s.nav} onClick={() => shift(1)}>›</button>
      </div>
      <div style={s.grid}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} style={s.dow}>{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const u = byDate[dateStr(d)];
          return (
            <div key={d} style={{ ...s.cell, ...(u ? s.cellActive : {}) }}
              onClick={() => u && setSelected(u)}>
              <div style={{ fontWeight: 600 }}>{d}</div>
              {u && <div style={s.hours}>{u.total_hours}h{u.has_blockers ? ' ⚠' : ''}</div>}
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>{selected.date} — {selected.total_hours}h {selected.locked ? '🔒' : ''}</strong>
            <button style={s.link} onClick={() => setSelected(null)}>Close</button>
          </div>
          {selected.entries.map((e, i) => (
            <div key={i} style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8, marginTop: 8 }}>
              <div>{e.work_done} <span style={{ color: '#6b7280' }}>({e.hours_spent}h · {e.status})</span></div>
              {e.blockers && <div style={{ color: '#b91c1c', fontSize: 13 }}>⚠ {e.blockers}</div>}
            </div>
          ))}
          {selected.tomorrow_plan && <p style={{ color: '#374151' }}><em>Tomorrow:</em> {selected.tomorrow_plan}</p>}
        </div>
      )}
    </div>
  );
}

const s = {
  head: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginBottom: 12 },
  nav: { background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', padding: '4px 12px', fontSize: 16 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 },
  dow: { textAlign: 'center', fontSize: 12, color: '#6b7280', fontWeight: 600, padding: 4 },
  cell: { minHeight: 56, border: '1px solid #f1f5f9', borderRadius: 8, padding: 6, background: '#fff' },
  cellActive: { background: '#f3f4f6', borderColor: '#bfdbfe', cursor: 'pointer' },
  hours: { fontSize: 12, color: '#111827', marginTop: 4 },
  link: { background: 'none', border: 'none', color: '#111827', cursor: 'pointer' },
};
