import { useMemo } from 'react';
import { PRIORITY_COLOR, statusLabel } from './tasksApi';
import TaskTypeIcon from '../../components/TaskTypeIcon';
import { IconUser } from '../../components/icons';

const initials = (n) => (n || '?').split(/[\s@.]+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

// Stable per-user avatar color (same name → same color) from a small palette.
const AVATAR_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#0ea5e9'];
const colorFor = (name) => {
  const s = name || '?';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

/**
 * Jira-style List view of a Space's tasks: Work / Assignee / Reporter / Priority /
 * Status. Read-only — clicking a row opens the task. Status shows as a colored chip.
 */
export default function TaskListView({ tasks, members, statuses = [], onOpenTask }) {
  const open = onOpenTask || (() => {});

  const nameOf = useMemo(() => {
    const map = {};
    (members || []).forEach((m) => { map[m.user_id] = m.full_name; });
    return (uid) => map[uid];
  }, [members]);

  const filtered = tasks; // search applied by the Space-level common toolbar

  // Space statuses PLUS any orphan status found on tasks (so labels/colors resolve).
  const allStatuses = useMemo(() => {
    const cols = [...statuses];
    (tasks || []).forEach((t) => {
      if (!cols.some((c) => c.key === t.status)) cols.push({ key: t.status, name: t.status, color: '#6b7280' });
    });
    return cols;
  }, [statuses, tasks]);

  return (
    <div>
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
            {filtered.map((t) => {
              const st = allStatuses.find((c) => c.key === t.status);
              const color = st?.color || '#6b7280';
              return (
                <tr key={t._id} className="wg-row-hover" style={s.row} onClick={() => open(t._id)}>
                  <Td>
                    <div style={s.workCell}>
                      <span title={t.type} style={{ display: 'inline-flex', color: 'var(--c-muted)' }}><TaskTypeIcon type={t.type} size={15} /></span>
                      <span style={s.key}>{t.key}</span>
                      <span>{t.title}</span>
                    </div>
                  </Td>
                  <Td>{personCell(nameOf(t.assignee_id))}</Td>
                  <Td>{personCell(nameOf(t.reporter_id))}</Td>
                  <Td><span style={{ color: PRIORITY_COLOR[t.priority], fontWeight: 600, textTransform: 'capitalize' }}>{t.priority}</span></Td>
                  <Td>
                    <span style={{ ...s.statusChip, background: `${color}22`, color }}>{statusLabel(allStatuses, t.status)}</span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function personCell(name) {
  if (!name) return <span style={{ color: 'var(--c-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={s.avatarEmpty}><IconUser size={13} /></span> Unassigned</span>;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ ...s.avatar, background: colorFor(name) }}>{initials(name)}</span> {name}</span>;
}

const Th = ({ children }) => <th style={s.th}>{children}</th>;
const Td = ({ children }) => <td style={s.td}>{children}</td>;

const s = {
  table: { width: '100%', borderCollapse: 'collapse', background: 'var(--c-surface)' },
  th: { textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, letterSpacing: '.02em',
    color: 'var(--c-muted)', background: 'var(--c-surface-2)', borderBottom: '1px solid var(--c-border)', whiteSpace: 'nowrap' },
  td: { padding: '12px 16px', fontSize: 14, verticalAlign: 'middle', color: 'var(--c-text)' },
  row: { borderTop: '1px solid var(--c-border-2)', cursor: 'pointer' },
  empty: { padding: 24, textAlign: 'center', color: 'var(--c-muted)' },
  workCell: { display: 'flex', alignItems: 'center', gap: 8 },
  key: { color: 'var(--c-text-strong)', fontWeight: 700 },
  avatar: { width: 22, height: 22, borderRadius: '50%', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 },
  avatarEmpty: { width: 22, height: 22, borderRadius: '50%', background: 'var(--c-surface-3)', color: 'var(--c-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 },
  statusChip: { display: 'inline-block', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
    letterSpacing: '.02em', textTransform: 'uppercase', whiteSpace: 'nowrap' },
};
