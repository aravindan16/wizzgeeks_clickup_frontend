import { useEffect, useRef, useState } from 'react';
import { IconSettings, IconEdit } from '../../components/icons';

/**
 * Gear button on the Space page. Clicking it shows a small card menu with a
 * "Space Setting" option (opens the space edit modal via `onSpaceSetting`).
 */
export default function SpaceSettingsMenu({ onSpaceSetting }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', h, true);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', h, true); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button className="icon-btn" style={s.gear} title="Space settings" onClick={() => setOpen((o) => !o)}>
        <IconSettings size={17} />
      </button>
      {open && (
        <div style={s.menu} role="menu">
          <button className="wg-menu-item" style={s.item}
            onClick={() => { setOpen(false); onSpaceSetting?.(); }}>
            <span style={s.itemIcon}><IconEdit size={16} /></span> Space Setting
          </button>
        </div>
      )}
    </div>
  );
}

const s = {
  gear: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38,
    border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-muted)', borderRadius: 9, cursor: 'pointer' },
  menu: { position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60, width: 190,
    background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10,
    boxShadow: '0 16px 40px rgba(16,24,40,.2)', padding: 6 },
  item: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px', border: 'none',
    borderRadius: 8, cursor: 'pointer', fontSize: 13.5, color: 'var(--c-text)', textAlign: 'left' },
  itemIcon: { display: 'inline-flex', alignItems: 'center', color: 'var(--c-muted)', flexShrink: 0 },
};
