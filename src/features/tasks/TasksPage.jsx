import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tasksApi, STATUSES, STATUS_LABELS, PRIORITIES, PRIORITY_COLOR } from './tasksApi';
import { projectsApi } from '../projects/projectsApi';
import Select from '../../components/Select';
import KanbanBoard from './KanbanBoard';
import TaskModal from './TaskModal';
import { useAuth } from '../auth/useAuth';

export default function TasksPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [projects, setProjects] = useState([]);
  const [view, setView] = useState('board'); // board | list
  const [filters, setFilters] = useState({ project_id: '', status: '', priority: '', search: '' });
  const [sort, setSort] = useState({ sort_by: 'created_at', sort_dir: -1 });
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = { limit: 200, ...sort };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    const [list, mx] = await Promise.all([
      tasksApi.list(params),
      tasksApi.metrics(filters.project_id ? { project_id: filters.project_id } : {}),
    ]);
    setTasks(list.items);
    setMetrics(mx);
    setLoading(false);
  }, [filters, sort]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    projectsApi.list({ limit: 200 }).then((d) => setProjects(d.items)).catch(() => {});
  }, []);

  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <div style={s.header}>
        <h2 style={{ margin: 0 }}>Tasks</h2>
        {can('task.create') && (
          <button style={s.primary} onClick={() => setModalOpen(true)}>+ Create Task</button>
        )}
      </div>

      {/* Metrics cards */}
      <div style={s.metrics}>
        <Metric label="Open" value={metrics?.open_tasks} color="#111827" />
        <Metric label="Closed" value={metrics?.closed_tasks} color="#166534" />
        <Metric label="Blocked" value={metrics?.blocked_tasks} color="#b91c1c" />
        <Metric label="Overdue" value={metrics?.overdue_tasks} color="#b45309" />
      </div>

      {/* Filters */}
      <div style={s.filters}>
        <Select style={{ minWidth: 150 }} value={filters.project_id} onChange={(v) => setFilter('project_id', v)}
          options={[{ value: '', label: 'All projects' }, ...projects.map((p) => ({ value: p._id, label: p.key }))]} />
        <Select style={{ minWidth: 150 }} value={filters.status} onChange={(v) => setFilter('status', v)}
          options={[{ value: '', label: 'All statuses' }, ...STATUSES.map((st) => ({ value: st, label: STATUS_LABELS[st] }))]} />
        <Select style={{ minWidth: 150 }} value={filters.priority} onChange={(v) => setFilter('priority', v)}
          options={[{ value: '', label: 'All priorities' }, ...PRIORITIES.map((p) => ({ value: p, label: p }))]} />
        <input style={s.input} placeholder="Search title or key…" value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)} />
        <Select style={{ minWidth: 140 }} value={`${sort.sort_by}:${sort.sort_dir}`}
          onChange={(v) => { const [b, d] = v.split(':'); setSort({ sort_by: b, sort_dir: Number(d) }); }}
          options={[{ value: 'created_at:-1', label: 'Newest' }, { value: 'created_at:1', label: 'Oldest' },
            { value: 'priority:-1', label: 'Priority' }, { value: 'due_date:1', label: 'Due date' }]} />
        <div style={s.toggle}>
          <button style={view === 'board' ? s.toggleActive : s.toggleBtn} onClick={() => setView('board')}>Board</button>
          <button style={view === 'list' ? s.toggleActive : s.toggleBtn} onClick={() => setView('list')}>List</button>
        </div>
      </div>

      {loading ? <p>Loading…</p> : view === 'board' ? (
        <KanbanBoard tasks={tasks} onChanged={load} />
      ) : (
        <div className="card" style={{ maxWidth: '100%', padding: 0, overflow: 'hidden' }}>
          <table style={s.table}>
            <thead><tr><Th>Key</Th><Th>Title</Th><Th>Status</Th><Th>Priority</Th><Th>Labels</Th></tr></thead>
            <tbody>
              {tasks.length === 0 && <tr><td colSpan={5} style={s.empty}>No tasks.</td></tr>}
              {tasks.map((t) => (
                <tr key={t._id} style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer' }}
                  onClick={() => navigate(`/tasks/${t._id}`)}>
                  <Td><span style={{ color: '#111827', fontWeight: 600 }}>{t.key}</span></Td>
                  <Td>{t.title}</Td>
                  <Td><span className="badge">{STATUS_LABELS[t.status]}</span></Td>
                  <Td><span style={{ color: PRIORITY_COLOR[t.priority], fontWeight: 600 }}>{t.priority}</span></Td>
                  <Td>{(t.labels || []).join(', ')}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TaskModal open={modalOpen} mode="create" projects={projects}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); load(); }} />
    </div>
  );
}

function Metric({ label, value, color }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
      <div style={{ fontSize: 26, fontWeight: 700, color }}>{value ?? '—'}</div>
      <div style={{ fontSize: 13, color: '#6b7280' }}>{label}</div>
    </div>
  );
}

const Th = ({ children }) => <th style={s.th}>{children}</th>;
const Td = ({ children }) => <td style={s.td}>{children}</td>;

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 16 },
  filters: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  input: { padding: '8px 11px', border: '1px solid #d1d5db', borderRadius: 8 },
  toggle: { display: 'flex', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden' },
  toggleBtn: { padding: '8px 14px', background: '#fff', border: 'none', cursor: 'pointer' },
  toggleActive: { padding: '8px 14px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff' },
  th: { textAlign: 'left', padding: '12px 14px', fontSize: 12, textTransform: 'uppercase', color: '#6b7280', background: '#f9fafb' },
  td: { padding: '10px 14px', fontSize: 14 },
  empty: { padding: 24, textAlign: 'center', color: '#6b7280' },
  primary: { padding: '9px 16px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
};
