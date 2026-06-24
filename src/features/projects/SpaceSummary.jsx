import { useEffect, useMemo, useState } from 'react';
import { projectsApi } from './projectsApi';
import { STATUS_LABELS } from '../tasks/tasksApi';
import DonutChart from '../../components/charts/DonutChart';
import { relativeTime } from '../../utils/relativeTime';
import TaskTypeIcon from '../../components/TaskTypeIcon';

const STATUS_COLOR = {
  backlog: '#94a3b8', planned: '#a78bfa', in_progress: '#3b82f6', blocked: '#ef4444',
  review: '#f59e0b', testing: '#14b8a6', completed: '#22c55e', closed: '#16a34a',
};
const PRIORITY_ORDER = [
  { value: 'critical', label: 'Critical', color: '#b91c1c' },
  { value: 'high', label: 'High', color: '#b45309' },
  { value: 'medium', label: 'Medium', color: '#111827' },
  { value: 'low', label: 'Low', color: '#6b7280' },
];
const TYPE_ORDER = [
  { value: 'task', label: 'Task', icon: '☑️' },
  { value: 'story', label: 'Story', icon: '🔖' },
  { value: 'subtask', label: 'Subtask', icon: '↳' },
  { value: 'epic', label: 'Epic', icon: '🏔️' },
  { value: 'bug', label: 'Bug', icon: '🐛' },
];
const DONE = ['completed', 'closed'];
const within = (ms, days) => ms && (Date.now() - new Date(ms).getTime()) <= days * 86400000 && new Date(ms).getTime() <= Date.now();
const dueWithin = (d, days) => {
  if (!d) return false;
  const t = new Date(`${d}T00:00`).getTime();
  return t >= Date.now() - 86400000 && t <= Date.now() + days * 86400000;
};

const actionText = (a) => ({
  'task.created': 'created', 'task.updated': 'updated', 'task.status_changed': 'changed status of',
  'task.assigned': 'assigned', 'task.deleted': 'deleted', 'task.archived': 'archived', 'task.worklog': 'logged work on',
}[a] || a);

export default function SpaceSummary({ tasks, members, statuses = [] }) {
  const [activity, setActivity] = useState([]);
  const [projectId, setProjectId] = useState(null);

  // Done detection + labels/colors from the space's own workflow when available.
  const doneKeys = statuses.length
    ? statuses.filter((s) => ['done', 'closed'].includes(s.group)).map((s) => s.key)
    : DONE;
  const isDone = (st) => doneKeys.includes(st);
  const labelFor = (st) => statuses.find((s) => s.key === st)?.name || STATUS_LABELS[st] || st;
  const colorFor = (st) => statuses.find((s) => s.key === st)?.color || STATUS_COLOR[st] || '#94a3b8';

  // tasks already belong to this space; derive the id for the activity fetch.
  useEffect(() => {
    if (tasks.length > 0) setProjectId(tasks[0].project_id);
  }, [tasks]);

  useEffect(() => {
    if (projectId) projectsApi.activity(projectId).then(setActivity).catch(() => setActivity([]));
  }, [projectId]);

  const nameOf = (uid) => members.find((m) => m.user_id === uid)?.full_name;

  const cards = useMemo(() => ({
    completed: tasks.filter((t) => isDone(t.status) && within(t.updated_at, 7)).length,
    updated: tasks.filter((t) => within(t.updated_at, 7)).length,
    created: tasks.filter((t) => within(t.created_at, 7)).length,
    dueSoon: tasks.filter((t) => !isDone(t.status) && dueWithin(t.due_date, 7)).length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [tasks, statuses]);

  const statusData = useMemo(() => {
    const counts = {};
    tasks.forEach((t) => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return Object.entries(counts).map(([st, value]) => ({ label: labelFor(st), value, color: colorFor(st) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, statuses]);

  const total = tasks.length || 1;
  const priorityData = PRIORITY_ORDER.map((p) => ({ ...p, count: tasks.filter((t) => t.priority === p.value).length }));
  const maxPriority = Math.max(1, ...priorityData.map((p) => p.count));
  const typeData = TYPE_ORDER.map((ty) => ({ ...ty, count: tasks.filter((t) => t.type === ty.value).length }));
  const workload = useMemo(() => {
    const counts = {};
    tasks.forEach((t) => { const k = t.assignee_id || 'unassigned'; counts[k] = (counts[k] || 0) + 1; });
    return Object.entries(counts).map(([k, count]) => ({
      name: k === 'unassigned' ? 'Unassigned' : (nameOf(k) || 'User'), count,
    })).sort((a, b) => b.count - a.count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, members]);

  return (
    <div>
      {/* Stat cards */}
      <div style={s.cards}>
        <Stat icon="✓" value={cards.completed} label="completed" sub="in the last 7 days" />
        <Stat icon="✏️" value={cards.updated} label="updated" sub="in the last 7 days" />
        <Stat icon="🗒️" value={cards.created} label="created" sub="in the last 7 days" />
        <Stat icon="📅" value={cards.dueSoon} label="due soon" sub="in the next 7 days" />
      </div>

      <div style={s.grid2}>
        {/* Status overview */}
        <Panel title="Status overview" subtitle="A snapshot of the status of your work items.">
          <DonutChart data={statusData} />
        </Panel>

        {/* Recent activity */}
        <Panel title="Recent activity" subtitle="Stay up to date with what's happening across the space.">
          {activity.length === 0 ? <p style={s.muted}>No recent activity.</p> : (
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {activity.map((a, i) => (
                <div key={i} style={s.activityRow}>
                  <span style={s.avatar}>{(a.actor_name || '?')[0]}</span>
                  <div style={{ fontSize: 13 }}>
                    <strong>{a.actor_name || 'Someone'}</strong> {actionText(a.action)}{' '}
                    {a.task_key && <span style={s.chip}>{a.task_key}</span>}
                    <div style={s.muted}>{a.created_at ? relativeTime(a.created_at) : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div style={s.grid2}>
        {/* Priority breakdown */}
        <Panel title="Priority breakdown" subtitle="How work is being prioritized.">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 150, paddingTop: 10 }}>
            {priorityData.map((p) => (
              <div key={p.value} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ background: p.color, height: `${(p.count / maxPriority) * 120}px`, borderRadius: 4, minHeight: 2 }} />
                <div style={{ fontSize: 12, marginTop: 6 }}>{p.count}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{p.label}</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Types of work */}
        <Panel title="Types of work" subtitle="A breakdown of work items by their types.">
          {typeData.map((ty) => (
            <div key={ty.value} style={s.distRow}>
              <span style={{ width: 90, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}><TaskTypeIcon type={ty.value} size={14} /> {ty.label}</span>
              <div style={s.barOuter}><div style={{ ...s.barInner, width: `${Math.round((ty.count / total) * 100)}%` }} /></div>
              <span style={{ width: 44, textAlign: 'right', fontSize: 12, color: '#6b7280' }}>{Math.round((ty.count / total) * 100)}%</span>
            </div>
          ))}
        </Panel>
      </div>

      {/* Team workload */}
      <Panel title="Team workload" subtitle="Monitor the capacity of your team.">
        {workload.map((w) => (
          <div key={w.name} style={s.distRow}>
            <span style={{ width: 140, fontSize: 14 }}>{w.name}</span>
            <div style={s.barOuter}><div style={{ ...s.barInner, width: `${Math.round((w.count / total) * 100)}%`, background: '#64748b' }} /></div>
            <span style={{ width: 44, textAlign: 'right', fontSize: 12, color: '#6b7280' }}>{Math.round((w.count / total) * 100)}%</span>
          </div>
        ))}
        {workload.length === 0 && <p style={s.muted}>No work items.</p>}
      </Panel>
    </div>
  );
}

function Stat({ icon, value, label, sub }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={s.statIcon}>{icon}</span>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{value} <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span></div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{sub}</div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <div className="card" style={{ maxWidth: '100%' }}>
      <strong>{title}</strong>
      {subtitle && <div style={{ fontSize: 13, color: '#6b7280', margin: '2px 0 12px' }}>{subtitle}</div>}
      {children}
    </div>
  );
}

const s = {
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 },
  statIcon: { width: 36, height: 36, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16 },
  muted: { color: '#6b7280', fontSize: 13 },
  activityRow: { display: 'flex', gap: 10, padding: '8px 0', borderTop: '1px solid #f1f5f9' },
  avatar: { width: 28, height: 28, borderRadius: '50%', background: '#f59e0b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 },
  chip: { background: '#f1f2f4', color: '#3730a3', borderRadius: 4, padding: '1px 6px', fontSize: 12, fontWeight: 600 },
  distRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' },
  barOuter: { flex: 1, background: '#e5e7eb', borderRadius: 6, height: 16, overflow: 'hidden' },
  barInner: { background: '#3b82f6', height: '100%' },
};
