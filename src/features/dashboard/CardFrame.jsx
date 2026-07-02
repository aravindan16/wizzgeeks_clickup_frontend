import { IconTrash, IconSettings, IconGrip, IconExpand } from '../../components/icons';

/**
 * Chrome shared by every dashboard card: title + grip, and the
 * fullscreen / settings / remove actions. Fullscreen + settings both open the
 * single card modal (AddCardModal) — see DashboardHome.
 */
export default function CardFrame({ title, onRemove, onEdit, onExpand, fill = false, children }) {
  const stop = (e) => e.stopPropagation();
  return (
    <div style={{ ...s.card, ...(fill ? s.cardFill : {}) }}>
      <div className="wg-card-head" style={s.head}>
        <span style={s.titleWrap}>
          <span className="wg-card-grip" style={s.grip} title="Drag to move"><IconGrip size={16} /></span>
          <span style={s.title}>{title}</span>
        </span>
        <span className="wg-card-actions" style={s.actions}>
          {onExpand && <button className="icon-btn" style={s.btn} title="Full screen" onMouseDown={stop} onClick={onExpand}><IconExpand size={15} /></button>}
          {onEdit && <button className="icon-btn" style={s.btn} title="Settings" onMouseDown={stop} onClick={onEdit}><IconSettings size={15} /></button>}
          {onRemove && <button className="icon-btn" style={s.btn} title="Remove card" onMouseDown={stop} onClick={onRemove}><IconTrash size={15} /></button>}
        </span>
      </div>
      <div style={fill ? s.bodyFill : undefined}>{children}</div>
    </div>
  );
}

const s = {
  card: { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, boxShadow: 'var(--sh-xs)', overflow: 'hidden' },
  cardFill: { height: '100%', display: 'flex', flexDirection: 'column' },
  bodyFill: { flex: 1, minHeight: 0, overflow: 'auto' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--c-border-2)' },
  titleWrap: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  grip: { color: 'var(--c-faint)', display: 'inline-flex', cursor: 'grab' },
  title: { fontWeight: 700, fontSize: 15, color: 'var(--c-text-strong)' },
  actions: { display: 'inline-flex', alignItems: 'center', gap: 4 },
  btn: { border: 'none', color: 'var(--c-faint)', cursor: 'pointer', display: 'inline-flex' },
};
