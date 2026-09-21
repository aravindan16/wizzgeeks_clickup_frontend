import { IconBell } from '../../components/icons';

/** Shown when there are no notifications for the current filter. */
export default function NotificationEmptyState({ filter = 'all' }) {
  const label = filter === 'all' ? "You're all caught up" : `No ${filter} notifications`;
  return (
    <div style={s.wrap}>
      <span style={s.icon}><IconBell size={26} /></span>
      <div style={s.title}>{label}</div>
      <div style={s.sub}>New activity on your tasks will show up here.</div>
    </div>
  );
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: '48px 24px', textAlign: 'center', color: 'var(--c-muted)' },
  icon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52,
    borderRadius: '50%', background: 'var(--c-surface-3)', color: 'var(--c-faint)', marginBottom: 4 },
  title: { fontWeight: 600, color: 'var(--c-text)', fontSize: 14 },
  sub: { fontSize: 12.5 },
};
