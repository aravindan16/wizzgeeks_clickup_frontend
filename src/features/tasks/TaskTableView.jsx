import { PRIORITY_COLOR, statusLabel } from './tasksApi';
import TaskTypeIcon from '../../components/TaskTypeIcon';

const initials = (n) => (n || '?').split(/[\s@.]+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const fmtDate = (d) => (d ? new Date(`${d}T00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

/**
 * Spreadsheet-style Table view of a Space/List's tasks — numbered rows with
 * Name / Assignee / Status / Due date / Priority columns. Clicking a row opens
 * the task. Mirrors the ClickUp Table layout.
 */
export default function TaskTableView({ tasks, members, statuses = [], onCreate, onOpenTask }) {
  const open = onOpenTask || (() => {});
  const nameOf = (uid) => (members || []).find((m) => m.user_id === uid)?.full_name;
  const colorOf = (key) => statuses.find((st) => st.key === key)?.color || 'var(--c-muted)';

  return (
    <div className="card" style={{ maxWidth: '100%', padding: 0, overflow: 'auto' }}>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={{ ...s.th, width: 40, textAlign: 'center' }}>#</th>
            <th style={s.th}>Name</th>
            <th style={s.th}>Assignee</th>
            <th style={s.th}>Status</th>
            <th style={s.th}>Due date</th>
            <th style={s.th}>Priority</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 && <tr><td colSpan={6} style={s.empty}>No tasks.</td></tr>}
          {tasks.map((t, i) => {
            const col = colorOf(t.status);
            const due = t.end_date || t.due_date;
            return (
              <tr key={t._id} className="wg-sb-row" style={s.row} onClick={() => open(t._id)}>
                <td style={{ ...s.td, textAlign: 'center', color: 'var(--c-faint)' }}>{i + 1}</td>
                <td style={s.td}>
                  <span style={s.nameCell}>
                    <span style={{ display: 'inline-flex', color: 'var(--c-muted)' }}><TaskTypeIcon type={t.type} size={15} /></span>
                    <span style={s.key}>{t.key}</span>
                    <span>{t.title}</span>
                  </span>
                </td>
                <td style={s.td}>
                  {t.assignee_id
                    ? <span style={s.person}><span style={s.avatar}>{initials(nameOf(t.assignee_id))}</span>{nameOf(t.assignee_id) || '—'}</span>
                    : <span style={{ color: 'var(--c-faint)' }}>—</span>}
                </td>
                <td style={s.td}>
                  <span style={{ ...s.statusChip, background: `${col}22`, color: col }}>{statusLabel(statuses, t.status).toUpperCase()}</span>
                </td>
                <td style={{ ...s.td, color: due ? 'var(--c-text)' : 'var(--c-faint)' }}>{fmtDate(due) || '—'}</td>
                <td style={s.td}>
                  {t.priority
                    ? <span style={{ color: PRIORITY_COLOR[t.priority], fontWeight: 600, textTransform: 'capitalize' }}>{t.priority}</span>
                    : <span style={{ color: 'var(--c-faint)' }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {onCreate && <button style={s.addRow} onClick={onCreate}>+ New task</button>}
    </div>
  );
}

const s = {
  table: { width: '100%', borderCollapse: 'collapse', background: 'var(--c-surface)', color: 'var(--c-text)' },
  th: { textAlign: 'left', padding: '11px 14px', fontSize: 12, textTransform: 'uppercase', color: 'var(--c-muted)',
    background: 'var(--c-surface-2)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--c-border)' },
  td: { padding: '10px 14px', fontSize: 14, verticalAlign: 'middle', borderBottom: '1px solid var(--c-border-2)' },
  row: { cursor: 'pointer' },
  empty: { padding: 24, textAlign: 'center', color: 'var(--c-muted)' },
  nameCell: { display: 'flex', alignItems: 'center', gap: 8 },
  key: { fontWeight: 700, color: 'var(--c-text-strong)', fontSize: 12.5 },
  person: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  avatar: { width: 22, height: 22, borderRadius: '50%', background: '#f59e0b', color: '#fff', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 },
  statusChip: { fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap' },
  addRow: { display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '12px 14px', background: 'none',
    border: 'none', borderTop: '1px solid var(--c-border)', cursor: 'pointer', color: 'var(--c-muted)', fontSize: 14, textAlign: 'left' },
};
