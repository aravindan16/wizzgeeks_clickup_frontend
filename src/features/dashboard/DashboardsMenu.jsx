import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { dashboardsApi } from './dashboardsApi';
import { useConfirm, usePrompt } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { LayoutDashboard } from 'lucide-react';
import { IconPlus, IconDots, IconTrash, IconMembers, IconEdit, Chevron } from '../../components/icons';

// Sidebar Dashboard glyph — Lucide, tuned to the app's 1.9 stroke to match Users/Settings.
const IconDashboard = ({ size = 18 }) => <LayoutDashboard size={size} strokeWidth={1.9} />;

/**
 * Sidebar "Dashboard" section (ClickUp-style, mirrors SpacesMenu): the Dashboard
 * row expands to list the user's dashboards. Header has ⋯ + + to create; each
 * dashboard row reveals + (add card) and ⋯ (add card / delete) on hover.
 */
export default function DashboardsMenu({ collapsed }) {
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const promptDialog = usePrompt();
  const toast = useToast();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(true);
  const [items, setItems] = useState([]);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [rowMenu, setRowMenu] = useState(null); // dashboard id with open ⋯ menu
  const [renaming, setRenaming] = useState(null); // dashboard id being renamed inline
  const [draft, setDraft] = useState('');
  const creatingRef = useRef(false);

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
    const name = await promptDialog({
      title: 'Create dashboard', message: 'Give your dashboard a name.', placeholder: 'Dashboard name', confirmLabel: 'Create',
      validate: (v) => (items.some((x) => (x.name || '').trim().toLowerCase() === v.toLowerCase())
        ? 'A dashboard with this name already exists' : ''),
    });
    if (!name || !name.trim()) return;
    if (creatingRef.current) return; // guard: never create twice for one action
    creatingRef.current = true;
    try {
      const d = await dashboardsApi.create({ name: name.trim(), cards: [] });
      setItems((cur) => [...cur, d]);
      setOpen(true);
      window.dispatchEvent(new Event('wg-dashboards-changed'));
      toast.success(`Dashboard "${d.name}" created`);
      navigate(`/dashboard/${d.id}`);
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Could not create dashboard'); }
    finally { creatingRef.current = false; }
  };

  const shareDashboard = (d) => { setRowMenu(null); navigate(`/dashboard/${d.id}?share=1`); };

  const startRename = (d) => { setRowMenu(null); setDraft(d.name || ''); setRenaming(d.id); };
  const commitRename = async (d) => {
    const v = (draft || '').trim();
    setRenaming(null);
    if (!v || v === d.name) return;
    if (items.some((x) => x.id !== d.id && (x.name || '').trim().toLowerCase() === v.toLowerCase())) {
      toast.error('A dashboard with this name already exists'); return;
    }
    setItems((cur) => cur.map((x) => (x.id === d.id ? { ...x, name: v } : x))); // optimistic
    try { await dashboardsApi.update(d.id, { name: v }); window.dispatchEvent(new Event('wg-dashboards-changed')); }
    catch (err) { toast.error(err.response?.data?.error?.message || 'Could not rename dashboard'); load(); }
  };

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
      <div className={`wg-sb-row${location.pathname.startsWith('/dashboard') ? ' wg-navrow-active' : ''}`} style={s.row}>
        <NavLink to="/dashboard" end
          style={({ isActive }) => ({ ...s.navMain, ...(isActive ? s.active : {}) })}>
          <button type="button" className="wg-nav-toggle" title={open ? 'Collapse' : 'Expand'}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}>
            <span className="wg-nav-icon"><IconDashboard size={18} /></span>
            <span className="wg-nav-caret"><Chevron open={open} size={13} /></span>
          </button>
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
                {renaming === d.id ? (
                  <div style={s.childMain} onClick={(e) => e.stopPropagation()}>
                    <span style={s.dot}>{(d.name || 'D').charAt(0).toUpperCase()}</span>
                    <input autoFocus style={s.renameInput} value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => commitRename(d)}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(d); if (e.key === 'Escape') setRenaming(null); }} />
                  </div>
                ) : (
                  <div style={s.childMain} onClick={() => navigate(`/dashboard/${d.id}`)} title={d.name}>
                    <span style={s.dot}>{(d.name || 'D').charAt(0).toUpperCase()}</span>
                    <span style={s.childName}>{d.name}</span>
                  </div>
                )}
                <span className="wg-sb-actions" style={{ ...s.rowActions, ...(rowMenu === d.id ? s.actionsOpen : {}) }}>
                  <button className="icon-btn" style={s.iconBtn} title="Dashboard actions"
                    onClick={() => { setHeaderMenu(false); setRowMenu(rowMenu === d.id ? null : d.id); }}><IconDots size={16} /></button>
                  {rowMenu === d.id && (
                    <div style={{ ...s.dropdown, top: 'calc(100% - 2px)', right: 4 }} role="menu">
                      <button className="wg-menu-item" style={s.dropItem} onClick={() => startRename(d)}>
                        <span style={s.dropIcon}><IconEdit size={15} /></span> Rename
                      </button>
                      <button className="wg-menu-item" style={s.dropItem} onClick={() => shareDashboard(d)}>
                        <span style={s.dropIcon}><IconMembers size={15} /></span> Members
                      </button>
                      <div style={s.divider} />
                      <button className="wg-menu-item" style={{ ...s.dropItem, color: '#b91c1c' }} onClick={() => deleteDashboard(d)}>
                        <span style={{ ...s.dropIcon, color: '#b91c1c' }}><IconTrash size={15} /></span> Delete dashboard
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
  section: { position: 'relative' },
  row: { display: 'flex', alignItems: 'center', gap: 2, borderRadius: 8, position: 'relative', paddingRight: 6 },
  caret: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-muted)', display: 'inline-flex', padding: 4, flexShrink: 0 },
  navMain: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, padding: '9px 8px', borderRadius: 8,
    color: 'var(--c-muted)', textDecoration: 'none', fontSize: 14, fontWeight: 500 },
  active: { color: 'var(--c-text-strong)', fontWeight: 600 },
  navIcon: { width: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'inherit' },
  navToggle: { width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', flexShrink: 0 },
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
  renameInput: { flex: 1, minWidth: 0, font: 'inherit', fontSize: 13.5, padding: '3px 6px', border: '1px solid var(--c-primary)',
    borderRadius: 6, background: 'var(--c-surface)', color: 'var(--c-text-strong)', outline: 'none' },
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
