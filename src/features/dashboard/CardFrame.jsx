import { useState } from 'react';
import { IconTrash, IconSettings, IconGrip, IconExpand, IconClose } from '../../components/icons';

/**
 * Chrome shared by every dashboard card: title + grip, and the
 * fullscreen / settings / remove actions. `children` is the card body
 * (a pure element, so it can be rendered in both the card and the overlay).
 */
export default function CardFrame({ title, onRemove, onEdit, children }) {
  const [full, setFull] = useState(false);

  const actions = (
    <span style={s.actions}>
      <button className="icon-btn" style={s.btn} title={full ? 'Exit full screen' : 'Full screen'} onClick={() => setFull((f) => !f)}>
        {full ? <IconClose size={16} /> : <IconExpand size={15} />}
      </button>
      {onEdit && <button className="icon-btn" style={s.btn} title="Settings" onClick={onEdit}><IconSettings size={15} /></button>}
      {onRemove && <button className="icon-btn" style={s.btn} title="Remove card" onClick={onRemove}><IconTrash size={15} /></button>}
    </span>
  );

  return (
    <>
      <div style={s.card}>
        <div style={s.head}>
          <span style={s.titleWrap}>
            <span style={s.grip} title="Drag to reorder"><IconGrip size={16} /></span>
            <span style={s.title}>{title}</span>
          </span>
          {actions}
        </div>
        {children}
      </div>

      {full && (
        <div style={s.fsBackdrop} onClick={() => setFull(false)}>
          <div style={s.fsPanel} onClick={(e) => e.stopPropagation()}>
            <div style={s.head}><span style={s.title}>{title}</span>{actions}</div>
            <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
          </div>
        </div>
      )}
    </>
  );
}

const s = {
  card: { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, boxShadow: 'var(--sh-xs)', overflow: 'hidden' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--c-border-2)' },
  titleWrap: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  grip: { color: 'var(--c-faint)', display: 'inline-flex', cursor: 'grab' },
  title: { fontWeight: 700, fontSize: 15, color: 'var(--c-text-strong)' },
  actions: { display: 'inline-flex', alignItems: 'center', gap: 4 },
  btn: { border: 'none', color: 'var(--c-faint)', cursor: 'pointer', display: 'inline-flex' },
  fsBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  fsPanel: { background: 'var(--c-surface)', color: 'var(--c-text)', borderRadius: 14, width: '95vw', height: '92vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.3)' },
};
