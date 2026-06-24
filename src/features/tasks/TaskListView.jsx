import { useMemo, useState } from 'react';
import { tasksApi, PRIORITY_COLOR, statusLabel } from './tasksApi';
import { useAuth } from '../auth/useAuth';
import TaskTypeIcon from '../../components/TaskTypeIcon';
import Select from '../../components/Select';
import { IconUser } from '../../components/icons';

const initials = (n) => (n || '?').split(/[\s@.]+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/**
 * Jira-style List view of a Space's tasks: searchable table with Work / Assignee /
 * Reporter / Priority / Status (inline status change via the workflow transitions).
 */
export default function TaskListView({ tasks, members, statuses = [], onChanged, onCreate, onOpenTask }) {
  const open = onOpenTask || (() => {});
  const { can } = useAuth();
  const [error, setError] = useState(null);

  const nameOf = useMemo(() => {
    const map = {};
    (members || []).forEach((m) => { map[m.user_id] = m.full_name; });
    return (uid) => map[uid];
  }, [members]);

  const filtered = tasks; // search is applied by the Space-level common toolbar

  const changeStatus = async (task, to) => {
    if (to === task.status) return;
    setError(null);
    try { await tasksApi.changeStatus(task._id, { to_status: to }); onChanged(); }
    catch (err) { setError(err.response?.data?.error?.message || 'Could not change status'); }
  };

  // Any of the space's statuses (free movement); include current if it's an orphan.
  const statusOptions = (task) => (statuses.some((s) => s.key === task.status)
    ? statuses : [...statuses, { key: task.status, name: task.status }]);

  return (
    <div>
      {error && <p style={{ color: '#991b1b' }}>{error}</p>}

      <div className="card" style={{ maxWidth: '100%', padding: 0, overflow: 'auto' }}>
        <table style={s.table}>
          <thead>
            <tr>
              <Th>Work</Th><Th>Assignee</Th><Th>Reporter</Th><Th>Priority</Th><Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={s.empty}>{tasks.length === 0 ? 'No tasks yet.' : 'No matching work.'}</td></tr>
            )}
            {filtered.map((t) => (
              <tr key={t._id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <Td>
                  <div style={s.workCell}>
                    <span title={t.type} style={{ display: 'inline-flex', color: '#6b7280' }}><TaskTypeIcon type={t.type} size={15} /></span>
                    <button style={s.keyLink} onClick={() => open(t._id)}>{t.key}</button>
                    <span>{t.title}</span>
                  </div>
                </Td>
                <Td>{personCell(nameOf(t.assignee_id))}</Td>
                <Td>{personCell(nameOf(t.reporter_id))}</Td>
                <Td><span style={{ color: PRIORITY_COLOR[t.priority], fontWeight: 600, textTransform: 'capitalize' }}>{t.priority}</span></Td>
                <Td>
                  {can('task.status.update') ? (
                    <Select style={{ minWidth: 150 }} value={t.status} onChange={(v) => changeStatus(t, v)}
                      options={statusOptions(t).map((st) => ({ value: st.key, label: st.name }))} />
                  ) : <span className="badge">{statusLabel(statuses, t.status)}</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
        {can('task.create') && (
          <button style={s.createRow} onClick={onCreate}>+ Create</button>
        )}
      </div>
    </div>
  );
}

function personCell(name) {
  if (!name) return <span style={{ color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={s.avatarEmpty}><IconUser size={13} /></span> Unassigned</span>;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={s.avatar}>{initials(name)}</span> {name}</span>;
}

const Th = ({ children }) => <th style={s.th}>{children}</th>;
const Td = ({ children }) => <td style={s.td}>{children}</td>;

const s = {
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 },
  searchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, opacity: 0.6 },
  search: { width: '100%', boxSizing: 'border-box', padding: '8px 11px 8px 32px', border: '1px solid #d1d5db', borderRadius: 8 },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff' },
  th: { textAlign: 'left', padding: '12px 14px', fontSize: 12, textTransform: 'uppercase', color: '#6b7280', background: '#f9fafb', whiteSpace: 'nowrap' },
  td: { padding: '10px 14px', fontSize: 14, verticalAlign: 'middle' },
  empty: { padding: 24, textAlign: 'center', color: '#6b7280' },
  workCell: { display: 'flex', alignItems: 'center', gap: 8 },
  keyLink: { background: 'none', border: 'none', color: '#111827', fontWeight: 700, cursor: 'pointer', padding: 0 },
  avatar: { width: 22, height: 22, borderRadius: '50%', background: '#f59e0b', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 },
  avatarEmpty: { width: 22, height: 22, borderRadius: '50%', background: '#e5e7eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 },
  statusSelect: { padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 },
  createRow: { display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '12px 14px',
    background: 'none', border: 'none', borderTop: '1px solid #f1f5f9', cursor: 'pointer', color: '#475569', fontSize: 14, textAlign: 'left' },
};
