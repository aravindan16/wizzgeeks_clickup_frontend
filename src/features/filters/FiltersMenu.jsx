import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { IconFilter, IconPlus, IconDots, IconTrash, IconMembers, Chevron } from '../../components/icons';
import { savedFiltersApi } from './savedFiltersApi';
import FilterShareModal from './FilterShareModal';

/**
 * Sidebar "Filters" section (mirrors DashboardsMenu / SpacesMenu): the Filters row
 * expands to list the user's DB-stored saved filters. Header reveals ⋯ + + on
 * hover to start a new filter; each saved-filter row reveals ⋯ (delete) on hover.
 */
const ACTIVE_KEY = 'wg_active_filter';
const loadActive = () => { try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; } };

export default function FiltersMenu({ collapsed }) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState([]);        // [{id, name, cards, conj, owner_name}]
  const [active, setActive] = useState(loadActive); // currently-open saved filter id (highlighted)
  const [headerMenu, setHeaderMenu] = useState(false);
  const [rowMenu, setRowMenu] = useState(null);
  const [shareId, setShareId] = useState(null); // saved-filter id being shared

  const load = () => savedFiltersApi.list().then(setSaved).catch(() => setSaved([]));
  useEffect(() => {
    load();
    const onSaved = () => load();
    const onActive = () => setActive(loadActive());
    window.addEventListener('wg-saved-filters-changed', onSaved);
    window.addEventListener('wg-active-filter-changed', onActive);
    return () => { window.removeEventListener('wg-saved-filters-changed', onSaved); window.removeEventListener('wg-active-filter-changed', onActive); };
  }, []);
  useEffect(() => {
    const onClick = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) { setHeaderMenu(false); setRowMenu(null); } };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markActive = (id) => {
    try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* ignore */ }
    setActive(id);
    window.dispatchEvent(new Event('wg-active-filter-changed'));
  };
  const newFilter = () => { setHeaderMenu(false); markActive(''); navigate('/filters/new'); };
  const openSaved = (id) => { setRowMenu(null); markActive(id); navigate(`/filters/${id}`); };
  const deleteSaved = async (id) => {
    setRowMenu(null);
    try { await savedFiltersApi.remove(id); } catch { /* ignore */ }
    if (active === id) markActive('');
    load();
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
      <div className="wg-sb-row" style={s.row}>
        <button type="button" style={s.caret} onClick={() => setOpen((o) => !o)} title={open ? 'Collapse' : 'Expand'}>
          <Chevron open={open} size={13} />
        </button>
        <NavLink to="/filters" end style={({ isActive }) => ({ ...s.navMain, ...(isActive ? s.active : {}) })}>
          <span style={s.navIcon}><IconFilter size={18} /></span>
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
            <div key={sf.id} className="wg-sb-row" style={{ ...s.child, ...(active === sf.id ? s.childActive : {}) }}>
              <div style={s.childMain} onClick={() => openSaved(sf.id)} title={sf.name}>
                <span style={s.avatar}>{(sf.name || 'F').charAt(0).toUpperCase()}</span>
                <span style={s.childName}>{sf.name}</span>
              </div>
              <span className="wg-sb-actions" style={{ ...s.rowActions, ...(rowMenu === sf.id ? s.actionsOpen : {}) }}>
                <button className="icon-btn" style={s.iconBtn} title="Filter actions"
                  onClick={() => { setHeaderMenu(false); setRowMenu(rowMenu === sf.id ? null : sf.id); }}><IconDots size={16} /></button>
                {rowMenu === sf.id && (
                  <div style={{ ...s.dropdown, top: 'calc(100% - 2px)', right: 4 }} role="menu">
                    <button className="wg-menu-item" style={s.dropItem} onClick={() => { setRowMenu(null); setShareId(sf.id); }}>
                      <span style={s.dropIcon}><IconMembers size={15} /></span> Members
                    </button>
                    <div style={s.divider} />
                    <button className="wg-menu-item" style={{ ...s.dropItem, color: '#b91c1c' }} onClick={() => deleteSaved(sf.id)}>
                      <span style={s.dropIcon}><IconTrash size={15} /></span> Delete filter
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
  section: { marginBottom: 2, position: 'relative' },
  row: { display: 'flex', alignItems: 'center', gap: 2, borderRadius: 8, position: 'relative', paddingRight: 6 },
  caret: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-muted)', display: 'inline-flex', padding: 4, flexShrink: 0 },
  navMain: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, padding: '9px 8px', borderRadius: 8,
    color: 'var(--c-muted)', textDecoration: 'none', fontSize: 14, fontWeight: 500 },
  active: { color: 'var(--c-text-strong)', fontWeight: 600 },
  navIcon: { width: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'inherit' },
  label: { flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
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
