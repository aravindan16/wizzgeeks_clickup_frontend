import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout } from '../features/auth/authSlice';
import { useAuth } from '../features/auth/useAuth';
import SpacesMenu from '../features/spaces/SpacesMenu';
import DashboardsMenu from '../features/dashboard/DashboardsMenu';
import FiltersMenu from '../features/filters/FiltersMenu';
import { HeaderSlotContext } from './headerSlot';
import {
  IconDashboard, IconMembers, IconReports, IconSettings,
  IconSearch, IconHelp, IconChevronDown, IconPanel, IconUser, IconLogout,
} from '../components/icons';
import ThemeCustomizer from '../components/ThemeCustomizer';

/**
 * Application shell: a full-width top bar (brand · search · actions) over a
 * collapsible, permission-aware left sidebar + main content. Light ClickUp-style.
 */
const NAV = [
  { to: '/team-activity', label: 'Team Activity', Icon: IconMembers, permission: 'dailyupdate.read.team' },
  { to: '/users', label: 'Users', Icon: IconMembers, permission: 'user.read' },
  { to: '/audit', label: 'Audit Log', Icon: IconReports, permission: 'audit.read' },
  { to: '/settings', label: 'Settings', Icon: IconSettings, permission: 'admin.settings' },
];

const STORAGE_KEY = 'wg_sidebar_collapsed';

const initials = (n) => (n || '?').split(/[\s@.]+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function AppLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [slotEl, setSlotEl] = useState(null); // topbar node pages portal their breadcrumb into

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  };

  // Responsive: auto-collapse the sidebar on tablet/mobile widths.
  useEffect(() => {
    const onResize = () => { if (window.innerWidth < 1024) setCollapsed(true); };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const width = collapsed ? 68 : 240;
  const role = (user?.roles || [])[0] || 'member';

  // Shared renderer for a top-level sidebar link (used above and below the Spaces tree).
  const renderNav = (n) => (
    <NavLink key={n.to} to={n.to} end={n.end} title={n.label}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
      style={({ isActive }) => ({
        ...s.navItem,
        ...(collapsed ? s.navItemCollapsed : {}),
        ...(isActive ? s.navActive : {}),
      })}>
      <span style={s.navIcon}><n.Icon size={18} /></span>
      {!collapsed && <span style={s.navLabel}>{n.label}</span>}
    </NavLink>
  );

  return (
    <div style={s.shell}>

      {/* ===== TOP BAR (full width) ===== */}
      <header style={s.topbar}>
        <div style={{ ...s.brand, width, justifyContent: collapsed ? 'center' : 'space-between' }}>
          {!collapsed && (
            <div style={s.brandLeft}>
              <img src="/logo.png" alt="Taskmanager" style={{ width: 26, height: 26, objectFit: 'contain' }} />
              <span style={s.brandText}>Taskmanager</span>
            </div>
          )}
          <button style={s.panelBtn} onClick={toggle} title="Toggle sidebar"><IconPanel size={18} /></button>
        </div>

        {/* Page breadcrumb/title portals in here (fills the left side of the topbar). */}
        <div style={s.headerSlot} ref={setSlotEl} />

        <div style={s.searchArea}>
          <div style={s.searchBox} onClick={() => {}}>
            <span style={s.searchIcon}><IconSearch size={16} /></span>
            <span style={{ color: '#9ca3af' }}>Search...</span>
            <span style={s.kbd}>⌘K</span>
          </div>
        </div>

        <div style={s.topRight}>
          <UserMenu user={user} onProfile={() => navigate('/profile')} onLogout={() => dispatch(logout())}
            onCustomize={() => setCustomizeOpen(true)} />
        </div>
      </header>

      {/* ===== BODY: sidebar + main ===== */}
      <div style={s.body}>
        <aside style={{ ...s.sidebar, width }}>
          <div style={s.navScroll}>
            <nav style={s.nav}>
              <DashboardsMenu collapsed={collapsed} />
              {NAV.filter((n) => !n.permission || can(n.permission)).map(renderNav)}
              {can('project.read') && <SpacesMenu collapsed={collapsed} />}
              {can('task.read') && <FiltersMenu collapsed={collapsed} />}
            </nav>
          </div>

          {/* User chip (bottom) */}
          <button style={{ ...s.userChip, justifyContent: collapsed ? 'center' : 'flex-start' }}
            onClick={() => navigate('/profile')} title={user?.full_name}>
            <span style={s.chipAvatar}>{initials(user?.full_name)}</span>
            {!collapsed && (
              <span style={s.chipMeta}>
                <span style={s.chipName}>{user?.full_name}</span>
                <span style={s.chipRole}>{role}</span>
              </span>
            )}
          </button>
        </aside>

        <main style={s.main}>
          <HeaderSlotContext.Provider value={slotEl}><Outlet /></HeaderSlotContext.Provider>
        </main>
      </div>

      <ThemeCustomizer open={customizeOpen} onClose={() => setCustomizeOpen(false)} />
    </div>
  );
}

/** Avatar button → dropdown with user info, Profile, Customize, and Log out. */
function UserMenu({ user, onProfile, onLogout, onCustomize }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button style={{ ...s.avatarBtn, ...(open ? s.avatarBtnOpen : {}) }}
        title={user?.full_name} onClick={() => setOpen((o) => !o)}>
        {initials(user?.full_name)}
      </button>
      {open && (
        <div style={s.menu}>
          <div style={s.menuHead}>
            <span style={s.menuAvatar}>{initials(user?.full_name)}</span>
            <div style={{ minWidth: 0 }}>
              <div style={s.menuName}>{user?.full_name || 'User'}</div>
              <div style={s.menuEmail}>{user?.email}</div>
            </div>
          </div>
          <button className="wg-menu-item" style={s.menuItem} onClick={() => { setOpen(false); onProfile(); }}>
            <span style={s.menuIcon}><IconUser size={17} /></span> Profile
          </button>
          <button className="wg-menu-item" style={s.menuItem} onClick={() => { setOpen(false); onCustomize(); }}>
            <span style={s.menuIcon}><IconSettings size={17} /></span> Customize
          </button>
          <button className="wg-menu-item" style={{ ...s.menuItem, color: '#ef4444' }} onClick={() => { setOpen(false); onLogout(); }}>
            <span style={s.menuIcon}><IconLogout size={17} /></span> Log out
          </button>
        </div>
      )}
    </div>
  );
}

const s = {
  shell: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--c-surface)' },

  // --- top bar ---
  topbar: { display: 'flex', alignItems: 'center', height: 56, flexShrink: 0,
    borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface)', zIndex: 50 },
  brand: { display: 'flex', alignItems: 'center', gap: 8, height: '100%', padding: '0 14px',
    borderRight: '1px solid var(--c-border)', boxSizing: 'border-box', flexShrink: 0, overflow: 'hidden' },
  brandLeft: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  brandText: { fontWeight: 700, fontSize: 17, color: 'var(--c-text-strong)', whiteSpace: 'nowrap' },
  brandChevron: { color: 'var(--c-faint)', display: 'inline-flex', marginLeft: 2 },
  panelBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34,
    flexShrink: 0, border: 'none', background: 'none', color: 'var(--c-muted)', borderRadius: 8, cursor: 'pointer' },
  headerSlot: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', padding: '0 16px', overflow: 'hidden' },
  searchArea: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: 320, padding: '0 8px', flexShrink: 0 },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 480, height: 38,
    padding: '0 14px', background: 'var(--c-surface-3)', border: '1px solid transparent', borderRadius: 10, cursor: 'text', color: 'var(--c-faint)', fontSize: 14 },
  searchIcon: { color: 'var(--c-faint)', display: 'inline-flex' },
  kbd: { marginLeft: 'auto', fontSize: 12, color: 'var(--c-faint)', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 6, padding: '1px 6px' },
  topRight: { display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 0 6px' },
  topIconBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36,
    border: 'none', background: 'none', color: 'var(--c-muted)', borderRadius: 8, cursor: 'pointer' },

  // --- body / sidebar ---
  body: { flex: 1, minHeight: 0, display: 'flex' },
  sidebar: { background: 'var(--c-surface)', color: 'var(--c-text)', transition: 'width .2s cubic-bezier(.4,0,.2,1)',
    flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--c-border)', overflow: 'hidden' },
  navScroll: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 10px' },
  nav: { display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box',
    padding: '9px 12px', borderRadius: 8, color: 'var(--c-muted)', textDecoration: 'none', fontSize: 14,
    fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden' },
  navItemCollapsed: { justifyContent: 'center', padding: '10px 0', gap: 0 },
  navActive: { background: 'var(--c-hover)', color: 'var(--c-text-strong)', fontWeight: 600 },
  navIcon: { width: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'inherit' },
  navLabel: { flex: 1 },

  // --- user chip ---
  userChip: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box',
    padding: '12px 14px', background: 'none', border: 'none', borderTop: '1px solid var(--c-border)',
    cursor: 'pointer', textAlign: 'left' },
  chipAvatar: { width: 32, height: 32, borderRadius: '50%', background: '#f59e0b', color: '#fff', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 },
  chipMeta: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
  chipName: { fontSize: 14, fontWeight: 600, color: 'var(--c-text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  chipRole: { fontSize: 12, color: 'var(--c-faint)', whiteSpace: 'nowrap' },
  avatarBtn: { width: 30, height: 30, borderRadius: '50%', background: '#f59e0b', color: '#fff',
    border: '2px solid transparent', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center' },
  avatarBtnOpen: { borderColor: 'var(--c-text-strong)' },
  menu: { position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 280, background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,.16)', zIndex: 70, overflow: 'hidden' },
  menuHead: { display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'var(--c-surface-2)',
    borderBottom: '1px solid var(--c-border-2)' },
  menuAvatar: { width: 44, height: 44, borderRadius: '50%', background: '#f59e0b', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 },
  menuName: { fontWeight: 700, fontSize: 15, color: 'var(--c-text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  menuEmail: { fontSize: 13, color: 'var(--c-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  menuItem: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
    padding: '12px 16px', cursor: 'pointer', fontSize: 14, color: 'var(--c-text)' },
  menuIcon: { width: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'inherit' },
  main: { flex: 1, padding: 24, background: 'var(--c-surface-2)', minWidth: 0, overflow: 'auto', position: 'relative' },
};
