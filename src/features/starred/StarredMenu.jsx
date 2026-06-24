import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStarred } from './useStarred';
import { IconStar, IconSearch, IconFolder, Chevron } from '../../components/icons';
import { flyoutPos } from '../recent/RecentMenu';

/**
 * Sidebar "Starred" tab that opens a flyout listing the current user's starred
 * spaces. Closes on item click, outside click, or Esc.
 */
export default function StarredMenu({ collapsed }) {
  const items = useStarred();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => { if (open) setQuery(''); }, [open]);

  // Anchor the flyout to the viewport so the sidebar's overflow:hidden can't clip it.
  useEffect(() => {
    if (!open) return undefined;
    const place = () => setPos(flyoutPos(btnRef.current));
    place();
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc);
      window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  const go = (path) => { setOpen(false); navigate(path); };

  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button ref={btnRef} type="button" title="Starred" onClick={() => setOpen((o) => !o)}
        style={{ ...s.navItem, ...(collapsed ? s.navItemCollapsed : {}), ...(open ? s.navActive : {}) }}>
        <span style={s.navIcon}><IconStar size={18} /></span>
        {!collapsed && <span style={s.navLabel}>Starred</span>}
        {!collapsed && <span style={s.caret}><Chevron open={open} size={13} /></span>}
      </button>

      {open && (
        <div style={{ ...s.panel, top: pos?.top ?? -9999, left: pos?.left ?? -9999, maxHeight: pos?.maxHeight }} role="menu">
          <div style={s.panelHead}>
            <strong>Starred</strong>
            <button style={s.close} onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>
          <div style={s.searchWrap}>
            <span style={s.searchIcon}><IconSearch size={15} /></span>
            <input autoFocus style={s.search} placeholder="Search starred items"
              value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {filtered.length === 0 ? (
            <div style={s.empty}>{items.length === 0 ? 'No starred items yet. Star a space to see it here.' : 'No matches.'}</div>
          ) : (
            <div style={s.list}>
              {filtered.map((item) => (
                <button key={item.id} style={s.item} onClick={() => go(item.path)} title={item.name}>
                  <span style={s.itemIcon}><IconFolder size={16} /></span>
                  <span style={s.itemName}>{item.name}</span>
                  <span style={s.starOn}><IconStar size={14} /></span>
                </button>
              ))}
            </div>
          )}
          <button style={s.viewAll} onClick={() => go('/projects')}>
            <span style={{ display: 'inline-flex' }}><IconFolder size={15} /></span> View all spaces
          </button>
        </div>
      )}
    </div>
  );
}

const s = {
  navItem: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box',
    padding: '10px 12px', borderRadius: 8, color: '#475569', background: 'none', border: 'none',
    fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textAlign: 'left' },
  navItemCollapsed: { justifyContent: 'center', padding: '10px 0', gap: 0 },
  navActive: { background: '#f1f5f9', color: '#111827' },
  navIcon: { width: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'inherit' },
  navLabel: { flex: 1 },
  caret: { fontSize: 11, color: '#9ca3af' },
  panel: { position: 'fixed', width: 300, background: '#fff',
    color: '#111827', border: '1px solid #e5e7eb', borderRadius: 10,
    boxShadow: '0 12px 32px rgba(0,0,0,.2)', zIndex: 200, overflow: 'hidden',
    display: 'flex', flexDirection: 'column' },
  panelHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 14px', borderBottom: '1px solid #f1f5f9' },
  close: { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 15, padding: 4 },
  searchWrap: { position: 'relative', padding: '10px 12px', borderBottom: '1px solid #f1f5f9' },
  searchIcon: { position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'inline-flex' },
  search: { width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 32px',
    border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 },
  empty: { padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 14 },
  list: { flex: 1, minHeight: 0, maxHeight: 360, overflowY: 'auto', padding: 6 },
  item: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box',
    padding: '9px 10px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' },
  itemIcon: { width: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', flexShrink: 0 },
  itemName: { flex: 1, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  starOn: { color: '#111827', display: 'inline-flex', alignItems: 'center' },
  viewAll: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box',
    padding: '11px 14px', borderTop: '1px solid #f1f5f9', background: '#f9fafb', border: 'none',
    color: '#111827', fontWeight: 600, fontSize: 14, cursor: 'pointer', textAlign: 'left' },
};
