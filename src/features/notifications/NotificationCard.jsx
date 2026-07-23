import { IconClose, IconCheck, IconBell, IconBoard, IconMembers } from '../../components/icons';

const initials = (n) => (n || '?').split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

// Icon shown in the avatar slot for actor-less/system notifications (no "who").
const typeIcon = (type = '') => {
  if (type.startsWith('task')) return <IconBoard size={16} />;
  if (type.startsWith('project') || type.startsWith('user')) return <IconMembers size={16} />;
  return <IconBell size={16} />;
};

/** Compact relative time ("2m", "3h", "5d", "Jul 2"). */
function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * A single notification row: actor avatar, title, description, task name,
 * time-ago, unread dot, and Open-Task / mark-read / delete actions.
 */
export default function NotificationCard({ n, onOpenTask, onMarkRead, onRemove }) {
  const taskName = [n.entity_key, n.entity_title].filter(Boolean).join(' · ');
  const canOpen = n.entity_type === 'task' && n.entity_id;
  const hasActor = !!(n.actor_avatar_url || n.actor_name);
  return (
    <div style={{ ...s.row, ...(n.is_read ? {} : s.rowUnread) }} className="wg-row-hover">
      {/* Actor avatar — the person who triggered this. Falls back to a neutral
          type icon for system events that have no acting user. */}
      <span style={{ ...s.avatar, ...(hasActor
        ? (n.actor_avatar_color ? { background: n.actor_avatar_color } : {})
        : s.avatarSystem) }} title={n.actor_name || undefined}>
        {n.actor_avatar_url
          ? <img src={n.actor_avatar_url} alt="" style={s.avatarImg} />
          : hasActor
            ? initials(n.actor_name)
            : typeIcon(n.type)}
      </span>

      <div style={s.body}>
        <div style={s.titleRow}>
          {!n.is_read && <span style={s.unreadDot} title="Unread" />}
          <span style={s.title}>{n.title}</span>
        </div>
        {n.body && <div style={s.desc}>{n.body}</div>}
        {taskName && <div style={s.task}>{taskName}</div>}
        <div style={s.metaRow}>
          <span style={s.time}>{timeAgo(n.created_at)}</span>
          {canOpen && (
            <button type="button" style={s.openBtn} onClick={() => onOpenTask(n)}>Open Task</button>
          )}
        </div>
      </div>

      <div style={s.actions}>
        {!n.is_read && (
          <button className="icon-btn" style={s.iconBtn} title="Mark as read" onClick={() => onMarkRead(n.id)}>
            <IconCheck size={15} />
          </button>
        )}
        <button className="icon-btn" style={s.iconBtn} title="Delete" onClick={() => onRemove(n.id)}>
          <IconClose size={15} />
        </button>
      </div>
    </div>
  );
}

const s = {
  row: { display: 'flex', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--c-border-2)', alignItems: 'flex-start' },
  rowUnread: { background: 'var(--c-primary-weak)' },
  avatar: { width: 34, height: 34, borderRadius: '50%', background: '#f59e0b', color: '#fff', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, overflow: 'hidden' },
  avatarSystem: { background: 'var(--c-surface-3)', color: 'var(--c-muted)' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  body: { flex: 1, minWidth: 0 },
  titleRow: { display: 'flex', alignItems: 'center', gap: 6 },
  unreadDot: { width: 7, height: 7, borderRadius: '50%', background: 'var(--c-primary)', flexShrink: 0 },
  title: { fontSize: 13.5, fontWeight: 600, color: 'var(--c-text-strong)' },
  desc: { fontSize: 13, color: 'var(--c-text)', marginTop: 2, wordBreak: 'break-word' },
  task: { fontSize: 12, color: 'var(--c-muted)', marginTop: 3, fontWeight: 600 },
  metaRow: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 },
  time: { fontSize: 11.5, color: 'var(--c-faint)' },
  openBtn: { border: 'none', background: 'none', color: 'var(--c-primary)', fontWeight: 600, fontSize: 12, cursor: 'pointer', padding: 0 },
  actions: { display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 },
  iconBtn: { width: 26, height: 26, color: 'var(--c-faint)' },
};
