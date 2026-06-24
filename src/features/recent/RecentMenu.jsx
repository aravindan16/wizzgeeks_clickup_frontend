import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecentlyVisited } from './useRecentlyVisited';
import { relativeTime } from '../../utils/relativeTime';
import { IconRecent, IconSearch, IconFolder, Chevron } from '../../components/icons';
import RecentTypeIcon from '../../components/RecentTypeIcon';

/**
 * Sidebar "Recent" tab that opens a flyout panel (Jira-style) listing the last
 * visited pages. Lives in the sidebar; closes on item click or outside click.
 */
export default function RecentMenu({ collapsed }) {
  const items = useRecentlyVisited();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);

  // Reset the search box each time the panel opens.
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  // The sidebar uses overflow:hidden, so an absolutely-positioned flyout gets
  // clipped. Anchor it to the viewport (position:fixed) from the button's rect.
  useEffect(() => {
    if (!open) return undefined;
    const place = () => setPos(flyoutPos(btnRef.current));
    place();
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((i) => i.name.toLowerCase().includes(q) || i.type.toLowerCase().includes(q))
    : items;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        type="button"
        title="Recent"
        onClick={() => setOpen((o) => !o)}
        style={{ ...s.navItem, ...(collapsed ? s.navItemCollapsed : {}), ...(open ? s.navActive : {}) }}
      >
        <span style={s.navIcon}><IconRecent size={18} /></span>
        {!collapsed && <span style={s.navLabel}>Recent</span>}
        {!collapsed && <span style={s.caret}><Chevron open={open} size={13} /></span>}
      </button>

      {open && (
        <div style={{ ...s.panel, top: pos?.top ?? -9999, left: pos?.left ?? -9999, maxHeight: pos?.maxHeight }} role="menu">
          <div style={s.panelHead}>
            <strong>Recent</strong>
            <button style={s.close} onClick={() => setOpen(false)} aria-label="Close" title="Close">✕</button>
          </div>

          <div style={s.searchWrap}>
            <span style={s.searchIcon}><IconSearch size={15} /></span>
            <input
              autoFocus
              style={s.search}
              placeholder="Search recent items"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {filtered.length === 0 ? (
            <div style={s.empty}>{items.length === 0 ? 'No recent items yet.' : 'No matches.'}</div>
          ) : (
            <div style={s.list}>
              {filtered.map((item) => (
                <button key={item.path} style={s.item} onClick={() => go(item.path)} title={item.name}>
                  <span style={s.itemIcon}><RecentTypeIcon type={item.type} size={16} /></span>
                  <span style={s.itemMeta}>
                    <span style={s.itemName}>{item.name}</span>
                    <span style={s.itemSub}>{item.type} · {relativeTime(item.visited_at)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <button style={s.viewAll} onClick={() => go('/')}>
            <span style={s.viewAllIcon}><IconFolder size={15} /></span> View all recent items
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Position a sidebar flyout next to its trigger button using viewport coords
 * (position:fixed), so it isn't clipped by the sidebar's overflow:hidden.
 * Opens to the right of the button; flips left if it would overflow.
 */
export function flyoutPos(btn, width = 300) {
  if (!btn) return null;
  const r = btn.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = r.right + 8;
  if (left + width > vw - 8) left = Math.max(8, r.left - width - 8);
  const maxHeight = Math.min(480, vh - 16);
  let top = r.top;
  if (top + maxHeight > vh - 8) top = Math.max(8, vh - 8 - maxHeight);
  return { top, left, maxHeight };
}

const s = {
  // Match the sidebar nav item look from AppLayout.
  navItem: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box',
    padding: '10px 12px', borderRadius: 8, color: '#475569', background: 'none', border: 'none',
    fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textAlign: 'left' },
  navItemCollapsed: { justifyContent: 'center', padding: '10px 0', gap: 0 },
  navActive: { background: '#f1f5f9', color: '#111827' },
  navIcon: { width: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'inherit' },
  navLabel: { flex: 1 },
  caret: { fontSize: 11, color: '#9ca3af' },

  panel: {
    position: 'fixed', width: 300, background: '#fff',
    color: '#111827', border: '1px solid #e5e7eb', borderRadius: 10,
    boxShadow: '0 12px 32px rgba(0,0,0,.2)', zIndex: 200, overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  },
  panelHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 14px', borderBottom: '1px solid #f1f5f9' },
  close: { background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 15,
    lineHeight: 1, padding: 4, borderRadius: 6 },
  searchWrap: { position: 'relative', padding: '10px 12px', borderBottom: '1px solid #f1f5f9' },
  searchIcon: { position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'inline-flex' },
  search: { width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 32px',
    border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 },
  empty: { padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 14 },
  list: { flex: 1, minHeight: 0, maxHeight: 360, overflowY: 'auto', padding: 6 },
  item: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box',
    padding: '9px 10px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' },
  itemIcon: { width: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', flexShrink: 0 },
  itemMeta: { display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  itemName: { fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemSub: { fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' },
  viewAll: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box',
    padding: '11px 14px', borderTop: '1px solid #f1f5f9', background: '#f9fafb', border: 'none',
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10, color: '#111827', fontWeight: 600,
    fontSize: 14, cursor: 'pointer', textAlign: 'left' },
  viewAllIcon: { display: 'inline-flex', alignItems: 'center' },
};
