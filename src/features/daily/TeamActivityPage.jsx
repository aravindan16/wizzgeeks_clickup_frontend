import { useCallback, useEffect, useState } from 'react';
import { dailyApi, todayStr } from './dailyApi';

/**
 * Manager view: team daily updates for a date, who is missing an update, and
 * the active blockers — all scoped server-side by the manager's read permission.
 */
export default function TeamActivityPage() {
  const [tab, setTab] = useState('updates');
  const [date, setDate] = useState(todayStr());
  const [updates, setUpdates] = useState({ items: [], total: 0 });
  const [missing, setMissing] = useState([]);
  const [blockers, setBlockers] = useState([]);

  const load = useCallback(async () => {
    const [u, m, b] = await Promise.all([
      dailyApi.team({ date, limit: 200 }).catch(() => ({ items: [], total: 0 })),
      dailyApi.missing({ date }).catch(() => []),
      dailyApi.blockers({ date_from: date, date_to: date }).catch(() => []),
    ]);
    setUpdates(u); setMissing(m); setBlockers(b);
  }, [date]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Team Activity</h2>
        <input type="date" style={s.input} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div style={s.tabs}>
        <Tab id="updates" tab={tab} setTab={setTab} label={`Updates (${updates.total})`} />
        <Tab id="missing" tab={tab} setTab={setTab} label={`Missing (${missing.length})`} />
        <Tab id="blockers" tab={tab} setTab={setTab} label={`Blockers (${blockers.length})`} />
      </div>

      {tab === 'updates' && (
        <div>
          {updates.items.length === 0 && <div className="card">No updates for {date}.</div>}
          {updates.items.map((u) => (
            <div key={u._id} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{u.user_name}</strong>
                <span style={{ color: '#6b7280' }}>{u.total_hours}h {u.has_blockers ? '⚠' : ''}</span>
              </div>
              {u.entries.map((e, i) => (
                <div key={i} style={{ fontSize: 14, marginTop: 6 }}>
                  • {e.work_done} <span style={{ color: '#6b7280' }}>({e.hours_spent}h · {e.status})</span>
                  {e.blockers && <span style={{ color: '#b91c1c' }}> — ⚠ {e.blockers}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === 'missing' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {missing.length === 0 ? <div style={{ padding: 16 }}>Everyone submitted 🎉</div> :
            missing.map((u) => (
              <div key={u.user_id} style={s.row}>
                <span>{u.full_name}</span>
                <span style={{ color: '#6b7280' }}>{u.email}</span>
              </div>
            ))}
        </div>
      )}

      {tab === 'blockers' && (
        <div>
          {blockers.length === 0 ? <div className="card">No blockers reported.</div> :
            blockers.map((b, i) => (
              <div key={i} className="card" style={{ marginBottom: 8, borderLeft: '4px solid #b91c1c' }}>
                <strong>{b.user_name}</strong> <span style={{ color: '#6b7280' }}>· {b.date}</span>
                <div style={{ color: '#b91c1c', marginTop: 4 }}>⚠ {b.blockers}</div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function Tab({ id, tab, setTab, label }) {
  return <button style={tab === id ? s.tabActive : s.tab} onClick={() => setTab(id)}>{label}</button>;
}

const s = {
  tabs: { display: 'flex', gap: 4, margin: '16px 0', borderBottom: '1px solid #e5e7eb' },
  tab: { padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' },
  tabActive: { padding: '8px 16px', background: 'none', border: 'none', borderBottom: '2px solid #111827', cursor: 'pointer', fontWeight: 600 },
  input: { padding: '8px 11px', border: '1px solid #d1d5db', borderRadius: 8 },
  row: { display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderTop: '1px solid #f1f5f9' },
};
