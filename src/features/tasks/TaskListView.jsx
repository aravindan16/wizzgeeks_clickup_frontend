import { useMemo } from 'react';
import { PRIORITY_COLOR, statusLabel } from './tasksApi';
import TaskTypeIcon from '../../components/TaskTypeIcon';
import { IconUser } from '../../components/icons';
import ResizableTable from '../../components/ResizableTable';

const initials = (n) => (n || '?').split(/[\s@.]+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

// Stable per-user avatar color (same name → same color) from a small palette.
const AVATAR_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#0ea5e9'];
const colorFor = (name) => {
  const str = name || '?';
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

/**
 * Jira-style List view of a Space's tasks: Work / Assignee / Reporter / Priority /
 * Status. Read-only — clicking a row opens the task. Columns are drag-resizable
 * (shared ResizableTable).
 */
export default function TaskListView({ tasks, members, statuses = [], onOpenTask }) {
  const open = onOpenTask || (() => {});

  const nameOf = useMemo(() => {
    const map = {};
    (members || []).forEach((m) => { map[m.user_id] = m.full_name; });
    return (uid) => map[uid];
  }, [members]);

  // Space statuses PLUS any orphan status found on tasks (so labels/colors resolve).
  const allStatuses = useMemo(() => {
    const cols = [...statuses];
    (tasks || []).forEach((t) => {
      if (!cols.some((c) => c.key === t.status)) cols.push({ key: t.status, name: t.status, color: '#6b7280' });
    });
    return cols;
  }, [statuses, tasks]);

  const columns = [
    { key: 'work', label: 'Work', width: 380, min: 180, render: (t) => (
      <div style={s.workCell}>
        <span title={t.type} style={{ display: 'inline-flex', color: 'var(--c-muted)' }}><TaskTypeIcon type={t.type} size={15} /></span>
        <span style={s.key}>{t.key}</span>
        <span style={s.clip}>{t.title}</span>
      </div>
    ) },
    { key: 'assignee', label: 'Assignee', width: 180, min: 100, render: (t) => personCell(nameOf(t.assignee_id)) },
    { key: 'reporter', label: 'Reporter', width: 180, min: 100, render: (t) => personCell(nameOf(t.reporter_id)) },
    { key: 'priority', label: 'Priority', width: 120, min: 80, render: (t) => <span style={{ color: PRIORITY_COLOR[t.priority], fontWeight: 600, textTransform: 'capitalize' }}>{t.priority}</span> },
    { key: 'status', label: 'Status', width: 150, min: 100, render: (t) => {
      const st = allStatuses.find((c) => c.key === t.status);
      const color = st?.color || '#6b7280';
      return <span style={{ ...s.statusChip, background: `${color}22`, color }}>{statusLabel(allStatuses, t.status)}</span>;
    } },
  ];

  return (
    <ResizableTable persistKey="wg_task_list_cols" columns={columns} rows={tasks}
      rowKey={(t) => t._id} onRowClick={(t) => open(t._id)}
      emptyText={(tasks || []).length === 0 ? 'No tasks yet.' : 'No matching work.'} />
  );
}

function personCell(name) {
  if (!name) return <span style={{ color: 'var(--c-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={s.avatarEmpty}><IconUser size={13} /></span> Unassigned</span>;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ ...s.avatar, background: colorFor(name) }}>{initials(name)}</span> {name}</span>;
}

const s = {
  workCell: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  clip: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  key: { color: 'var(--c-text-strong)', fontWeight: 700, flexShrink: 0 },
  avatar: { width: 22, height: 22, borderRadius: '50%', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 },
  avatarEmpty: { width: 22, height: 22, borderRadius: '50%', background: 'var(--c-surface-3)', color: 'var(--c-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 },
  statusChip: { display: 'inline-block', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
    letterSpacing: '.02em', textTransform: 'uppercase', whiteSpace: 'nowrap' },
};
