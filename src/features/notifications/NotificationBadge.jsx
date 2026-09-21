/** Small unread-count badge shown on the bell (caps at 99+). */
export default function NotificationBadge({ count = 0 }) {
  if (!count) return null;
  return <span style={s.badge}>{count > 99 ? '99+' : count}</span>;
}

const s = {
  badge: {
    position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, padding: '0 4px',
    borderRadius: 999, background: 'var(--c-danger, #dc2626)', color: '#fff',
    fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center',
    boxShadow: '0 0 0 2px var(--c-surface)', pointerEvents: 'none',
  },
};
