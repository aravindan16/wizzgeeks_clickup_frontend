import { PRIORITY_COLOR, statusLabel } from './tasksApi';
import TaskTypeIcon from '../../components/TaskTypeIcon';
import ResizableTable from '../../components/ResizableTable';

const initials = (n) => (n || '?').split(/[\s@.]+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const fmtDate = (d) => (d ? new Date(`${d}T00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

/**
 * Spreadsheet-style Table view of a Space/List's tasks — numbered rows with
 * Name / Assignee / Status / Due date / Priority columns. Clicking a row opens
 * the task. Columns are drag-resizable (shared ResizableTable).
 */
export default function TaskTableView({ tasks, members, statuses = [], onOpenTask }) {
  const open = onOpenTask || (() => {});
  const nameOf = (uid) => (members || []).find((m) => m.user_id === uid)?.full_name;
  const colorOf = (key) => statuses.find((st) => st.key === key)?.color || 'var(--c-muted)';

  const columns = [
    { key: 'idx', label: '#', width: 48, min: 40, align: 'center', render: (t, i) => <span style={{ color: 'var(--c-faint)' }}>{i + 1}</span> },
    { key: 'name', label: 'Name', width: 360, min: 160, render: (t) => (
      <span style={s.nameCell}>
        <span style={{ display: 'inline-flex', color: 'var(--c-muted)' }}><TaskTypeIcon type={t.type} size={15} /></span>
        <span style={s.key}>{t.key}</span>
        <span style={s.clip}>{t.title}</span>
      </span>
    ) },
    { key: 'assignee', label: 'Assignee', width: 180, min: 100, render: (t) => (t.assignee_id
      ? <span style={s.person}><span style={s.avatar}>{initials(nameOf(t.assignee_id))}</span>{nameOf(t.assignee_id) || '—'}</span>
      : <span style={{ color: 'var(--c-faint)' }}>—</span>) },
    { key: 'status', label: 'Status', width: 150, min: 100, render: (t) => {
      const col = colorOf(t.status);
      return <span style={{ ...s.statusChip, background: `${col}22`, color: col }}>{statusLabel(statuses, t.status).toUpperCase()}</span>;
    } },
    { key: 'due', label: 'Due date', width: 120, min: 80, render: (t) => {
      const due = t.end_date || t.due_date;
      return <span style={{ color: due ? 'var(--c-text)' : 'var(--c-faint)' }}>{fmtDate(due) || '—'}</span>;
    } },
    { key: 'priority', label: 'Priority', width: 120, min: 80, render: (t) => (t.priority
      ? <span style={{ color: PRIORITY_COLOR[t.priority], fontWeight: 600, textTransform: 'capitalize' }}>{t.priority}</span>
      : <span style={{ color: 'var(--c-faint)' }}>—</span>) },
  ];

  return (
    <ResizableTable persistKey="wg_task_table_cols" columns={columns} rows={tasks}
      rowKey={(t) => t._id} onRowClick={(t) => open(t._id)} emptyText="No tasks." />
  );
}

const s = {
  nameCell: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  clip: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  key: { fontWeight: 700, color: 'var(--c-text-strong)', fontSize: 12.5, flexShrink: 0 },
  person: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  avatar: { width: 22, height: 22, borderRadius: '50%', background: '#f59e0b', color: '#fff', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 },
  statusChip: { fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap' },
};
