import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from './dashboardApi';
import { useAuth } from '../auth/useAuth';
import BarChart from '../../components/charts/BarChart';
import { STATUS_LABELS } from '../tasks/tasksApi';

/**
 * Role-aware dashboard. Tabs are filtered by the user's permissions; each tab
 * lazy-loads its own analytics endpoint and renders cards + charts.
 */
export default function DashboardHome() {
  const { user, can } = useAuth();

  const tabs = useMemo(() => {
    const t = [{ id: 'my', label: 'My Dashboard' }];
    if (can('dashboard.view.team')) t.push({ id: 'team', label: 'Team' });
    if (can('report.view.all')) t.push({ id: 'manager', label: 'Manager' });
    if (can('dashboard.view.admin')) t.push({ id: 'admin', label: 'Admin' });
    return t;
  }, [can]);

  const [tab, setTab] = useState('my');

  return (
    <div>
      <h2>Welcome, {user?.full_name}</h2>
      <div style={s.tabs}>
        {tabs.map((t) => (
          <button key={t.id} style={tab === t.id ? s.tabActive : s.tab} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'my' && <EmployeeView />}
      {tab === 'team' && <TeamView />}
      {tab === 'manager' && <ManagerView />}
      {tab === 'admin' && <AdminView />}
    </div>
  );
}

function useFetch(fn, deps = []) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let live = true;
    fn().then((d) => live && setData(d)).catch((e) => live && setErr(e.response?.data?.error?.message || 'Error'));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [data, err];
}

function EmployeeView() {
  const navigate = useNavigate();
  const [d] = useFetch(() => dashboardApi.employee());
  if (!d) return <p>Loading…</p>;
  const trend = d.activity_trend.map((p) => ({ label: p.date.slice(8), value: p.hours }));
  return (
    <div>
      <div style={s.cards}>
        <Stat label="Open Tasks" value={d.open_tasks} color="#111827" />
        <Stat label="Completed" value={d.completed_tasks} color="#166534" />
        <Stat label="Blocked" value={d.blocked_tasks} color="#b91c1c" />
        <Stat label="Overdue" value={d.overdue_tasks} color="#b45309" />
        <Stat label="Hours Today" value={`${d.hours_today}h`} />
        <Stat label="Weekly Hours" value={`${d.weekly_hours}h`} />
      </div>
      <div style={s.row2}>
        <Panel title="Personal Activity Trend (14 days)">
          <BarChart data={trend} suffix="h" />
        </Panel>
        <Panel title="Today's Tasks">
          {d.todays_tasks.length === 0 ? <p style={s.muted}>Nothing due. 🎉</p> :
            d.todays_tasks.map((t) => (
              <div key={t._id} style={s.taskRow} onClick={() => navigate(`/tasks/${t._id}`)}>
                <span style={{ color: '#111827', fontWeight: 600 }}>{t.key}</span> {t.title}
                <span style={s.muted}> · {STATUS_LABELS[t.status] || t.status}</span>
              </div>
            ))}
        </Panel>
      </div>
    </div>
  );
}

function TeamView() {
  const [d] = useFetch(() => dashboardApi.team());
  if (!d) return <p>Loading…</p>;
  const dist = d.task_distribution.map((s2) => ({ label: (STATUS_LABELS[s2.status] || s2.status).slice(0, 6), value: s2.count }));
  const prod = d.team_productivity.map((m) => ({ label: (m.full_name || '').split(' ')[0], value: m.hours }));
  return (
    <div>
      <div style={s.cards}>
        <Stat label="Team Members" value={d.team_members.length} />
        <Stat label="Missing Updates" value={d.missing_updates.length} color="#b45309" />
        <Stat label="Open Blockers" value={d.open_blockers.length} color="#b91c1c" />
      </div>
      <div style={s.row2}>
        <Panel title="Team Productivity (week hours)"><BarChart data={prod} suffix="h" color="#166534" /></Panel>
        <Panel title="Team Task Distribution"><BarChart data={dist} /></Panel>
      </div>
      <div style={s.row2}>
        <Panel title="Team Capacity">
          {d.team_capacity.map((c) => (
            <div key={c.user_id} style={s.capRow}>
              <span>{c.full_name}</span>
              <span style={s.muted}>{c.open_tasks} open · {c.hours_week}h</span>
            </div>
          ))}
        </Panel>
        <Panel title="Open Blockers">
          {d.open_blockers.length === 0 ? <p style={s.muted}>None 🎉</p> :
            d.open_blockers.map((b, i) => (
              <div key={i} style={{ borderLeft: '3px solid #b91c1c', paddingLeft: 8, marginBottom: 8 }}>
                <strong>{b.user_name}</strong> <span style={s.muted}>{b.date}</span>
                <div style={{ color: '#b91c1c', fontSize: 13 }}>{b.blockers}</div>
              </div>
            ))}
        </Panel>
      </div>
    </div>
  );
}

function ManagerView() {
  const navigate = useNavigate();
  const [d] = useFetch(() => dashboardApi.manager());
  if (!d) return <p>Loading…</p>;
  const perf = d.team_performance.map((m) => ({ label: (m.full_name || '').split(' ')[0], value: m.hours }));
  return (
    <div>
      <div style={s.cards}>
        <Stat label="Projects" value={d.project_progress.length} />
        <Stat label="Delayed Tasks" value={d.delayed_count} color="#b91c1c" />
        <Stat label="Weekly Hours" value={`${d.weekly_report.total_hours}h`} />
        <Stat label="Blockers (wk)" value={d.weekly_report.blocker_count} color="#b45309" />
      </div>
      <div style={s.row2}>
        <Panel title="Project Progress">
          {d.project_progress.map((p) => (
            <div key={p.project_id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span><strong>{p.key}</strong> {p.name}</span><span>{p.progress}%</span>
              </div>
              <div style={s.barOuter}><div style={{ ...s.barInner, width: `${p.progress}%` }} /></div>
            </div>
          ))}
        </Panel>
        <Panel title="Team Performance (week hours)"><BarChart data={perf} suffix="h" color="#166534" /></Panel>
      </div>
      <Panel title={`Delayed Tasks (${d.delayed_count})`}>
        {d.delayed_tasks.length === 0 ? <p style={s.muted}>None 🎉</p> :
          d.delayed_tasks.map((t) => (
            <div key={t._id} style={s.taskRow} onClick={() => navigate(`/tasks/${t._id}`)}>
              <span style={{ color: '#111827', fontWeight: 600 }}>{t.key}</span> {t.title}
              <span style={{ color: '#b91c1c' }}> · due {t.due_date}</span>
            </div>
          ))}
      </Panel>
    </div>
  );
}

function AdminView() {
  const [d] = useFetch(() => dashboardApi.admin());
  if (!d) return <p>Loading…</p>;
  const dist = d.tasks_by_status.map((s2) => ({ label: (STATUS_LABELS[s2.status] || s2.status).slice(0, 6), value: s2.count }));
  return (
    <div>
      <div style={s.cards}>
        <Stat label="Total Users" value={d.total_users} />
        <Stat label="Active Users" value={d.active_users} color="#166534" />
        <Stat label="Projects" value={`${d.active_projects}/${d.total_projects}`} />
        <Stat label="Tasks" value={d.total_tasks} />
        <Stat label="Completion" value={`${d.completion_rate}%`} color="#111827" />
        <Stat label="Prod. Score" value={d.productivity_score} color="#7c3aed" />
      </div>
      <div style={s.cards}>
        <Stat label="Open" value={d.open_tasks} color="#111827" />
        <Stat label="Blocked" value={d.blocked_tasks} color="#b91c1c" />
        <Stat label="Overdue" value={d.overdue_tasks} color="#b45309" />
        <Stat label="Weekly Hours" value={`${d.weekly_hours}h`} />
        <Stat label="Missing Today" value={d.missing_updates_today} color="#b45309" />
      </div>
      <div style={s.row2}>
        <Panel title="Tasks by Status"><BarChart data={dist} /></Panel>
        <Panel title="Project Progress">
          {d.project_progress.map((p) => (
            <div key={p.project_id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span><strong>{p.key}</strong></span><span>{p.progress}%</span>
              </div>
              <div style={s.barOuter}><div style={{ ...s.barInner, width: `${p.progress}%` }} /></div>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || '#111827' }}>{value ?? '—'}</div>
      <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="card" style={{ maxWidth: '100%' }}>
      <strong style={{ display: 'block', marginBottom: 10 }}>{title}</strong>
      {children}
    </div>
  );
}

const s = {
  tabs: { display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e5e7eb' },
  tab: { padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' },
  tabActive: { padding: '8px 16px', background: 'none', border: 'none', borderBottom: '2px solid #111827', cursor: 'pointer', fontWeight: 600 },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 16 },
  row2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 16 },
  muted: { color: '#6b7280', fontSize: 13 },
  taskRow: { padding: '6px 0', borderTop: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 14 },
  capRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #f1f5f9', fontSize: 14 },
  barOuter: { background: '#e5e7eb', borderRadius: 999, height: 8, marginTop: 4, overflow: 'hidden' },
  barInner: { background: '#111827', height: '100%' },
};
