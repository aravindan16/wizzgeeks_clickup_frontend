/**
 * Bulk selection bar shown above a List/Table view once rows are ticked.
 * "Bulk change work items" hands the selected tasks to the shared 4-step
 * Bulk Operation wizard (the same one the Filters page uses).
 */
export default function BulkSelectBar({ count, total, allSelected, onToggleAll, onClear, onStart }) {
  if (!count) return null;
  return (
    <div style={s.bar}>
      <span style={s.count}>{count} selected</span>
      <button type="button" className="btn btn-primary" style={s.btn} onClick={onStart}>Bulk change work items</button>
      {!allSelected && total > count && (
        <button type="button" style={s.link} onClick={onToggleAll}>Select all {total}</button>
      )}
      <button type="button" className="icon-btn" style={s.clear} onClick={onClear} title="Clear selection">✕</button>
    </div>
  );
}

const s = {
  bar: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', flexShrink: 0,
    borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface-2)' },
  count: { fontSize: 13, fontWeight: 700, color: 'var(--c-text-strong)', marginRight: 4 },
  btn: { fontSize: 13, fontWeight: 600, padding: '6px 12px' },
  link: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--c-text-strong)', textDecoration: 'underline' },
  clear: { marginLeft: 'auto', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 15, padding: 4 },
};
