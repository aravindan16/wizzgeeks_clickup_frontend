import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { dashboardsApi } from './dashboardsApi';
import { useConfirm } from '../../components/ConfirmDialog';
import { IconDashboard, IconPlus, IconDots, IconTrash, Chevron } from '../../components/icons';

/**
 * Sidebar "Dashboard" section (ClickUp-style, mirrors SpacesMenu): the Dashboard
 * row expands to list the user's dashboards. Header has ⋯ + + to create; each
 * dashboard row reveals + (add card) and ⋯ (add card / delete) on hover.
 */
export default function DashboardsMenu({ collapsed }) {
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(true);
  const [items, setItems] = useState([]);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [rowMenu, setRowMenu] = useState(null); // dashboard id with open ⋯ menu

  const load = async () => {
    try { const r = await dashboardsApi.list(); setItems(r.items || []); } catch { setItems([]); }
  };
  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener('wg-dashboards-changed', onChange);
    return () => window.removeEventListener('wg-dashboards-changed', onChange);
  }, []);

  // Close menus on outside click.
  useEffect(() => {
    const onClick = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) { setHeaderMenu(false); setRowMenu(null); } };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const createDashboard = async () => {
    setHeaderMenu(false);
    try {
      const d = await dashboardsApi.create({ name: 'Dashboard', cards: [] });
      setItems((cur) => [...cur, d]);
      setOpen(true);
      window.dispatchEvent(new Event('wg-dashboards-changed'));
      navigate(`/dashboard/${d.id}`);
    } catch { /* ignore */ }
  };

  const addCard = (d) => { setRowMenu(null); navigate(`/dashboard/${d.id}?add=1`); };

  const deleteDashboard = async (d) => {
    setRowMenu(null);
    if (!(await confirm({ title: 'Delete dashboard', message: `Delete "${d.name}"? This can't be undone.`, confirmLabel: 'Delete', danger: true }))) return;
    try {
      await dashboardsApi.remove(d.id);
      setItems((cur) => cur.filter((x) => x.id !== d.id));
      window.dispatchEvent(new Event('wg-dashboards-changed'));
      if (location.pathname === `/dashboard/${d.id}`) navigate('/dashboard');
    } catch { /* ignore */ }
  };

  if (collapsed) {
    return (
      <button title="Dashboards" style={{ ...s.navItem, ...s.navItemCollapsed }} onClick={() => navigate('/dashboard')}>
        <span style={s.navIcon}><IconDashboard size={18} /></span>
      </button>
    );
  }

  return (
    <div style={s.section} ref={rootRef}>
      <div className="wg-sb-row" style={s.row}>
        <button type="button" style={s.caret} onClick={() => setOpen((o) => !o)} title={open ? 'Collapse' : 'Expand'}>
          <Chevron open={open} size={13} />
        </button>
        <NavLink to="/dashboard" end
          style={({ isActive }) => ({ ...s.navMain, ...(isActive ? s.active : {}) })}>
          <span style={s.navIcon}><IconDashboard size={18} /></span>
          <span style={s.label}>Dashboard</span>
        </NavLink>
        <span style={s.headerActions}>
          <button className="icon-btn" style={s.iconBtn} title="Dashboard actions"
            onClick={() => { setRowMenu(null); setHeaderMenu((o) => !o); }}><IconDots size={16} /></button>
          <button className="icon-btn" style={s.iconBtn} title="New dashboard" onClick={createDashboard}><IconPlus size={16} /></button>
          {headerMenu && (
            <div style={s.dropdown} role="menu">
              <button className="wg-menu-item" style={s.dropItem} onClick={createDashboard}>
                <span style={s.dropIcon}><IconPlus size={15} /></span> Create Dashboard
              </button>
            </div>
          )}
        </span>
      </div>

      {open && (
        <div style={s.children}>
          {items.length === 0 && <div style={s.empty}>No dashboards yet</div>}
          {items.map((d) => {
            const active = location.pathname === `/dashboard/${d.id}`;
            return (
              <div key={d.id} className="wg-sb-row" style={{ ...s.child, ...(active ? s.childActive : {}) }}>
                <div style={s.childMain} onClick={() => navigate(`/dashboard/${d.id}`)} title={d.name}>
                  <span style={s.dot}>{(d.name || 'D').charAt(0).toUpperCase()}</span>
                  <span style={s.childName}>{d.name}</span>
                </div>
                <span className="wg-sb-actions" style={{ ...s.rowActions, ...(rowMenu === d.id ? s.actionsOpen : {}) }}>
                  <button className="icon-btn" style={s.iconBtn} title="Dashboard actions"
                    onClick={() => { setHeaderMenu(false); setRowMenu(rowMenu === d.id ? null : d.id); }}><IconDots size={16} /></button>
                  <button className="icon-btn" style={s.iconBtn} title="Add card" onClick={() => addCard(d)}><IconPlus size={16} /></button>
                  {rowMenu === d.id && (
                    <div style={{ ...s.dropdown, top: 'calc(100% - 2px)', right: 4 }} role="menu">
                      <button className="wg-menu-item" style={s.dropItem} onClick={() => addCard(d)}>
                        <span style={s.dropIcon}><IconPlus size={15} /></span> Create card
                      </button>
                      <div style={s.divider} />
                      <button className="wg-menu-item" style={{ ...s.dropItem, color: '#b91c1c' }} onClick={() => deleteDashboard(d)}>
                        <span style={s.dropIcon}><IconTrash size={15} /></span> Delete dashboard
                      </button>
                    </div>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
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
  headerIconBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 4, borderRadius: 6 },
  rowActions: { gap: 0, position: 'relative', flexShrink: 0 },
  actionsOpen: { display: 'flex' }, // keep actions + open menu visible after cursor leaves the row
  iconBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 4, borderRadius: 6 },

  children: { display: 'flex', flexDirection: 'column', gap: 1, margin: '2px 0 2px 22px' },
  child: { position: 'relative', display: 'flex', alignItems: 'center', borderRadius: 8, paddingRight: 6,
    color: 'var(--c-muted)', fontSize: 13.5 },
  childActive: { background: 'var(--c-hover)', color: 'var(--c-text-strong)', fontWeight: 600 },
  childMain: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, padding: '6px 4px 6px 8px', cursor: 'pointer' },
  dot: { width: 22, height: 22, borderRadius: 6, background: '#111827', color: '#ffffff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 },
  childName: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'inherit' },
  empty: { fontSize: 12.5, color: 'var(--c-faint)', padding: '6px 10px' },

  // dropdown menu (mirrors SpacesMenu)
  dropdown: { position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: 180, background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 10, boxShadow: '0 10px 28px rgba(0,0,0,.18)', zIndex: 60, padding: 4 },
  dropItem: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box', padding: '8px 10px',
    border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 6, fontSize: 13.5, color: 'var(--c-text)' },
  dropIcon: { display: 'inline-flex', color: 'var(--c-muted)' },
  divider: { height: 1, background: 'var(--c-border-2)', margin: '4px 0' },

  // collapsed
  navItem: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box',
    padding: '9px 12px', borderRadius: 8, color: 'var(--c-muted)', background: 'none', border: 'none',
    cursor: 'pointer', fontSize: 14 },
  navItemCollapsed: { justifyContent: 'center', padding: '10px 0', gap: 0 },
};
