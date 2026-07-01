import { useCardData } from './useCardData';
import CardFrame from './CardFrame';
import { IconListCheck } from '../../components/icons';

/**
 * Portfolio card: for each tracked List/EPIC, a progress bar (done / total),
 * the Done count, and the # of overdue (Due) tasks.
 */
export default function PortfolioCard({ card, onRemove, onEdit }) {
  const data = useCardData(card);
  const rows = data?.rows || null;

  const table = (
    <div style={{ overflowX: 'auto' }}>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Name</th>
            <th style={s.th}>Progress</th>
            <th style={s.thC}>Done</th>
            <th style={s.thC}>Due</th>
          </tr>
        </thead>
        <tbody>
          {rows === null && <tr><td colSpan={4} style={s.empty}>Loading…</td></tr>}
          {rows && rows.length === 0 && <tr><td colSpan={4} style={s.empty}>No lists selected.</td></tr>}
          {rows && rows.map((r) => {
            const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
            return (
              <tr key={r.id} style={s.row}>
                <td style={s.td}>
                  <span style={s.nameCell}>
                    <span style={s.nameIcon}><IconListCheck size={15} /></span>
                    <span>
                      <div style={s.listName}>{r.name}</div>
                      <div style={s.spaceName}>{r.spaceName}</div>
                    </span>
                  </span>
                </td>
                <td style={s.td}>
                  <div style={s.progWrap}>
                    <div style={s.progBar}><div style={{ ...s.progFill, width: `${pct}%` }} /></div>
                    <span style={s.progText}>{r.done}/{r.total}</span>
                  </div>
                </td>
                <td style={{ ...s.tdC, color: r.done ? '#16a34a' : 'var(--c-faint)' }}>{r.done}</td>
                <td style={{ ...s.tdC, color: r.due ? '#ef4444' : 'var(--c-faint)' }}>{r.due}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return <CardFrame title={card.title} onRemove={onRemove} onEdit={onEdit}>{table}</CardFrame>;
}

const s = {
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 520 },
  th: { textAlign: 'left', padding: '10px 16px', fontSize: 12, color: 'var(--c-muted)', fontWeight: 600, background: 'var(--c-surface-2)' },
  thC: { textAlign: 'center', padding: '10px 16px', fontSize: 12, color: 'var(--c-muted)', fontWeight: 600, background: 'var(--c-surface-2)' },
  row: { borderTop: '1px solid var(--c-border-2)', cursor: 'pointer' },
  td: { padding: '10px 16px', fontSize: 14, verticalAlign: 'middle' },
  tdC: { padding: '10px 16px', fontSize: 14, textAlign: 'center', fontWeight: 600 },
  empty: { padding: 20, textAlign: 'center', color: 'var(--c-muted)' },
  caret: { color: 'var(--c-muted)', display: 'inline-flex' },
  nameCell: { display: 'inline-flex', alignItems: 'center', gap: 9 },
  nameIcon: { color: 'var(--c-muted)', display: 'inline-flex' },
  listName: { fontWeight: 600, color: 'var(--c-text-strong)' },
  spaceName: { fontSize: 12, color: 'var(--c-muted)' },
  progWrap: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 180 },
  progBar: { flex: 1, height: 8, borderRadius: 999, background: 'var(--c-surface-3)', overflow: 'hidden' },
  progFill: { height: '100%', background: 'var(--c-primary)', borderRadius: 999, transition: 'width .3s' },
  progText: { fontSize: 12.5, color: 'var(--c-muted)', whiteSpace: 'nowrap', minWidth: 36, textAlign: 'right' },

  // expanded task rows
  taskRow: { borderTop: '1px solid var(--c-border-2)', background: 'var(--c-surface-2)' },
  taskNameTd: { padding: '8px 16px 8px 52px', fontSize: 13.5, color: 'var(--c-text)' },
  taskName: { display: 'inline-block', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' },
  statusChip: { display: 'inline-block', padding: '2px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600 },
  taskEmpty: { padding: '8px 16px 8px 52px', fontSize: 13, color: 'var(--c-faint)', background: 'var(--c-surface-2)' },
  groupRow: { borderTop: '1px solid var(--c-border-2)', background: 'var(--c-surface-3)' },
  groupName: { padding: '6px 16px 6px 40px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--c-muted)' },
};
