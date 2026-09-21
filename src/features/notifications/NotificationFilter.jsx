/** Filter tabs for the notification drawer. */
const TABS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'comments', label: 'Comments' },
  { key: 'assignments', label: 'Assignments' },
];

export default function NotificationFilter({ value, onChange }) {
  return (
    <div style={s.wrap}>
      {TABS.map((t) => (
        <button key={t.key} type="button" onClick={() => onChange(t.key)}
          style={{ ...s.chip, ...(value === t.key ? s.chipActive : {}) }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

const s = {
  wrap: { display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 14px', borderBottom: '1px solid var(--c-border)' },
  chip: { border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-muted)',
    borderRadius: 999, padding: '5px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  chipActive: { background: 'var(--c-primary)', color: 'var(--c-on-primary)', borderColor: 'var(--c-primary)' },
};
