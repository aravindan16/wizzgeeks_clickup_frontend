import { useCallback, useEffect, useState } from 'react';
import DailyActivityForm from './DailyActivityForm';
import CalendarView from './CalendarView';
import { dailyApi } from './dailyApi';
import Select from '../../components/Select';

export default function MyActivityPage() {
  const [tab, setTab] = useState('form'); // form | calendar | summary
  const [summary, setSummary] = useState(null);
  const [period, setPeriod] = useState('week');

  const loadSummary = useCallback(() => {
    dailyApi.summary({ period }).then(setSummary).catch(() => setSummary(null));
  }, [period]);

  useEffect(() => { if (tab === 'summary') loadSummary(); }, [tab, loadSummary]);

  return (
    <div>
      <h2>My Daily Activity</h2>
      <div style={s.tabs}>
        {['form', 'calendar', 'summary'].map((t) => (
          <button key={t} style={tab === t ? s.tabActive : s.tab} onClick={() => setTab(t)}>
            {t === 'form' ? 'Today' : t === 'calendar' ? 'Calendar' : 'Summary'}
          </button>
        ))}
      </div>

      {tab === 'form' && <DailyActivityForm onSaved={loadSummary} />}
      {tab === 'calendar' && <CalendarView />}
      {tab === 'summary' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Select style={{ minWidth: 150 }} value={period} onChange={setPeriod}
              options={[{ value: 'week', label: 'This Week' }, { value: 'month', label: 'This Month' }]} />
          </div>
          {!summary ? <p>Loading…</p> : (
            <>
              <div style={s.cards}>
                <Card label="Total Hours" value={summary.total_hours} />
                <Card label="Updates" value={summary.updates_count} />
                <Card label="Blockers" value={summary.blocker_count} color="#b91c1c" />
                <Card label="Range" value={`${summary.start_date} → ${summary.end_date}`} small />
              </div>
              <div className="card" style={{ marginTop: 16 }}>
                <strong>Hours by day</strong>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 120, marginTop: 12 }}>
                  {Object.entries(summary.hours_by_day).map(([day, hrs]) => (
                    <div key={day} style={{ textAlign: 'center', flex: 1 }}>
                      <div style={{ background: '#111827', height: `${Math.min(100, hrs * 10)}px`, borderRadius: 4 }} />
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{day.slice(5)}</div>
                      <div style={{ fontSize: 11 }}>{hrs}h</div>
                    </div>
                  ))}
                  {Object.keys(summary.hours_by_day).length === 0 && <span style={{ color: '#6b7280' }}>No data</span>}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ label, value, color, small }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
      <div style={{ fontSize: small ? 13 : 26, fontWeight: 700, color: color || '#111827' }}>{value}</div>
      <div style={{ fontSize: 13, color: '#6b7280' }}>{label}</div>
    </div>
  );
}

const s = {
  tabs: { display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e5e7eb' },
  tab: { padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' },
  tabActive: { padding: '8px 16px', background: 'none', border: 'none', borderBottom: '2px solid #111827',
    cursor: 'pointer', fontWeight: 600 },
  input: { padding: '8px 11px', border: '1px solid #d1d5db', borderRadius: 8 },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 },
};
