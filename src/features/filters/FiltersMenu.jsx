import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { IconPlus, IconDots, IconTrash, IconMembers, IconEdit, Chevron } from '../../components/icons';
import { ListFilter } from 'lucide-react';

// Sidebar Filters glyph — Lucide, tuned to the app's 1.9 stroke to match Users/Settings.
const IconFilter = ({ size = 18 }) => <ListFilter size={size} strokeWidth={1.9} />;
import { savedFiltersApi } from './savedFiltersApi';
import FilterShareModal from './FilterShareModal';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

/**
 * Sidebar "Filters" section (mirrors DashboardsMenu / SpacesMenu): the Filters row
 * expands to list the user's DB-stored saved filters. Header reveals ⋯ + + on
 * hover to start a new filter; each saved-filter row reveals ⋯ (delete) on hover.
 */
export default function FiltersMenu({ collapsed }) {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const confirm = useConfirm();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState([]);        // [{id, name, cards, conj, owner_name}]
  const [headerMenu, setHeaderMenu] = useState(false);
  const [rowMenu, setRowMenu] = useState(null);
  const [shareId, setShareId] = useState(null); // saved-filter id being shared
  const [renaming, setRenaming] = useState(null); // saved-filter id being renamed inline
  const [draft, setDraft] = useState('');

  // Highlight ONLY the filter whose page we're currently on (route-driven), so the
  // highlight clears when you navigate to a List/Space/anywhere else.
  const activeId = (location.pathname.match(/^\/filters\/([^/]+)$/) || [])[1] || '';

  const load = () => savedFiltersApi.list().then(setSaved).catch(() => setSaved([]));
  useEffect(() => {
    load();
    const onSaved = () => load();
    window.addEventListener('wg-saved-filters-changed', onSaved);
    return () => window.removeEventListener('wg-saved-filters-changed', onSaved);
  }, []);
  useEffect(() => {
    const onClick = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) { setHeaderMenu(false); setRowMenu(null); } };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const newFilter = () => { setHeaderMenu(false); navigate('/filters/new'); };
  const openSaved = (id) => { setRowMenu(null); navigate(`/filters/${id}`); };
  const deleteSaved = async (sf) => {
    setRowMenu(null);
    if (!(await confirm({ title: 'Delete filter', message: `Delete "${sf.name}"? This can't be undone.`, confirmLabel: 'Delete', danger: true }))) return;
    try { await savedFiltersApi.remove(sf.id); toast.success('Filter deleted'); } catch { toast.error('Could not delete filter'); }
    if (activeId === sf.id) navigate('/filters');
    load();
    window.dispatchEvent(new Event('wg-saved-filters-changed'));
  };
  const startRename = (sf) => { setRowMenu(null); setDraft(sf.name || ''); setRenaming(sf.id); };
  const commitRename = async (sf) => {
    const v = (draft || '').trim();
    setRenaming(null);
    if (!v || v === sf.name) return;
    setSaved((list) => list.map((x) => (x.id === sf.id ? { ...x, name: v } : x))); // optimistic
    try { await savedFiltersApi.update(sf.id, { name: v }); toast.success('Filter renamed'); } catch { toast.error('Could not rename filter'); }
    window.dispatchEvent(new Event('wg-saved-filters-changed'));
  };

  if (collapsed) {
    return (
      <button title="Filters" style={{ ...s.navItem, ...s.navItemCollapsed }} onClick={() => navigate('/filters')}>
        <span style={s.navIcon}><IconFilter size={18} /></span>
      </button>
    );
  }

  return (
    <div style={s.section} ref={rootRef}>
      <div className={`wg-sb-row${location.pathname.startsWith('/filters') ? ' wg-navrow-active' : ''}`} style={s.row}>
        <NavLink to="/filters" end style={({ isActive }) => ({ ...s.navMain, ...(isActive ? s.active : {}) })}>
          <button type="button" className="wg-nav-toggle" title={open ? 'Collapse' : 'Expand'}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}>
            <span className="wg-nav-icon"><IconFilter size={18} /></span>
            <span className="wg-nav-caret"><Chevron open={open} size={13} /></span>
          </button>
          <span style={s.label}>Filters</span>
        </NavLink>
        <span style={s.headerActions}>
          <button className="icon-btn" style={s.iconBtn} title="Filter actions"
            onClick={() => { setRowMenu(null); setHeaderMenu((o) => !o); }}><IconDots size={16} /></button>
          <button className="icon-btn" style={s.iconBtn} title="New filter" onClick={newFilter}><IconPlus size={16} /></button>
          {headerMenu && (
            <div style={s.dropdown} role="menu">
              <button className="wg-menu-item" style={s.dropItem} onClick={newFilter}>
                <span style={s.dropIcon}><IconPlus size={15} /></span> New filter
              </button>
            </div>
          )}
        </span>
      </div>

      {open && (
        <div style={s.children}>
          {saved.length === 0 && <div style={s.empty}>No saved filters yet</div>}
          {saved.map((sf) => (
            <div key={sf.id} className="wg-sb-row" style={{ ...s.child, ...(activeId === sf.id ? s.childActive : {}) }}>
              {renaming === sf.id ? (
                <div style={s.childMain}>
                  <span style={s.avatar}>{(draft || 'F').charAt(0).toUpperCase()}</span>
                  <input style={s.renameInput} value={draft} autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commitRename(sf)}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitRename(sf); if (e.key === 'Escape') setRenaming(null); }} />
                </div>
              ) : (
                <div style={s.childMain} onClick={() => openSaved(sf.id)} title={sf.name}>
                  <span style={s.avatar}>{(sf.name || 'F').charAt(0).toUpperCase()}</span>
                  <span style={s.childName}>{sf.name}</span>
                </div>
              )}
              <span className="wg-sb-actions" style={{ ...s.rowActions, ...(rowMenu === sf.id ? s.actionsOpen : {}) }}>
                <button className="icon-btn" style={s.iconBtn} title="Filter actions"
                  onClick={() => { setHeaderMenu(false); setRowMenu(rowMenu === sf.id ? null : sf.id); }}><IconDots size={16} /></button>
                {rowMenu === sf.id && (
                  <div style={{ ...s.dropdown, top: 'calc(100% - 2px)', right: 4 }} role="menu">
                    <button className="wg-menu-item" style={s.dropItem} onClick={() => startRename(sf)}>
                      <span style={s.dropIcon}><IconEdit size={15} /></span> Rename
                    </button>
                    <button className="wg-menu-item" style={s.dropItem} onClick={() => { setRowMenu(null); setShareId(sf.id); }}>
                      <span style={s.dropIcon}><IconMembers size={15} /></span> Members
                    </button>
                    <div style={s.divider} />
                    <button className="wg-menu-item" style={{ ...s.dropItem, color: '#b91c1c' }} onClick={() => deleteSaved(sf)}>
                      <span style={{ ...s.dropIcon, color: '#b91c1c' }}><IconTrash size={15} /></span> Delete filter
                    </button>
                  </div>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      <FilterShareModal open={!!shareId} filterId={shareId} onClose={() => setShareId(null)} onChanged={load} />
    </div>
  );
}

const s = {
  section: { position: 'relative' },
  row: { display: 'flex', alignItems: 'center', gap: 2, borderRadius: 8, position: 'relative', paddingRight: 6 },
  caret: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-muted)', display: 'inline-flex', padding: 4, flexShrink: 0 },
  navMain: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, padding: '9px 8px', borderRadius: 8,
    color: 'var(--c-muted)', textDecoration: 'none', fontSize: 14, fontWeight: 500 },
  active: { color: 'var(--c-text-strong)', fontWeight: 600 },
  navIcon: { width: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'inherit' },
  label: { flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 13, fontWeight: 600, letterSpacing: '0.01em' },
  headerActions: { display: 'inline-flex', alignItems: 'center', gap: 2, position: 'relative', flexShrink: 0 },
  rowActions: { gap: 0, position: 'relative', flexShrink: 0 },
  actionsOpen: { display: 'flex' },
  iconBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 4, borderRadius: 6 },

  children: { display: 'flex', flexDirection: 'column', gap: 1, margin: '2px 0 2px 22px' },
  child: { position: 'relative', display: 'flex', alignItems: 'center', borderRadius: 8, paddingRight: 6, color: 'var(--c-muted)', fontSize: 13.5 },
  childActive: { background: 'var(--c-hover)', color: 'var(--c-text-strong)', fontWeight: 600 },
  childMain: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, padding: '6px 4px 6px 8px', cursor: 'pointer' },
  avatar: { width: 22, height: 22, borderRadius: 6, background: '#111827', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 },
  childName: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'inherit' },
  renameInput: { flex: 1, minWidth: 0, font: 'inherit', fontSize: 13.5, padding: '3px 6px', border: '1px solid var(--c-primary)',
    borderRadius: 6, background: 'var(--c-surface)', color: 'var(--c-text)', outline: 'none' },
  empty: { fontSize: 12.5, color: 'var(--c-faint)', padding: '6px 10px' },

  dropdown: { position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: 170, background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 10, boxShadow: '0 10px 28px rgba(0,0,0,.18)', zIndex: 60, padding: 4 },
  dropItem: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box', padding: '8px 10px',
    border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 6, fontSize: 13.5, color: 'var(--c-text)' },
  dropIcon: { display: 'inline-flex', color: 'var(--c-muted)' },
  divider: { height: 1, background: 'var(--c-border-2)', margin: '4px 0' },

  navItem: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box',
    padding: '9px 12px', borderRadius: 8, color: 'var(--c-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 },
  navItemCollapsed: { justifyContent: 'center', padding: '10px 0', gap: 0 },
};
