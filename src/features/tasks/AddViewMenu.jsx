import { useEffect, useRef } from 'react';
import { VIEW_TYPES } from './viewsStore';
import { IconList, IconBoard, IconListCheck } from '../../components/icons';

const ICON = { list: IconList, board: IconBoard, table: IconListCheck };

/** Small popover to create a new view. Limited to List / Board / Table. */
export default function AddViewMenu({ open, onClose, onPick }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onEsc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onClick, true);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onClick, true); document.removeEventListener('keydown', onEsc); };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div ref={ref} style={s.pop}>
      <div style={s.head}>New view</div>
      {VIEW_TYPES.map((t) => {
        const Icon = ICON[t.type];
        return (
          <button key={t.type} className="wg-menu-item" style={s.item}
            onClick={() => { onClose(); onPick(t.type); }}>
            <span style={s.icon}><Icon size={16} /></span> {t.label}
          </button>
        );
      })}
    </div>
  );
}

const s = {
  pop: { position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, minWidth: 200, background: 'var(--c-surface)',
    color: 'var(--c-text)', border: '1px solid var(--c-border)', borderRadius: 10, boxShadow: '0 14px 34px rgba(0,0,0,.18)', padding: 6 },
  head: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--c-muted)', padding: '6px 8px' },
  item: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: 'none', border: 'none',
    padding: '9px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 14, color: 'var(--c-text)' },
  icon: { display: 'inline-flex', color: 'var(--c-muted)' },
};
