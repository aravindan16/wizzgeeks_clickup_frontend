import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout } from '../features/auth/authSlice';
import { useAuth } from '../features/auth/useAuth';
import NotificationBell from '../features/notifications/NotificationBell';
import GlobalLoader from '../components/GlobalLoader';
import SpacesMenu from '../features/spaces/SpacesMenu';
import {
  IconDashboard, IconMembers, IconReports, IconSettings,
  IconSearch, IconHelp, IconChevronDown, IconPanel, IconUser, IconLogout,
} from '../components/icons';

/**
 * Application shell: a full-width top bar (brand · search · actions) over a
 * collapsible, permission-aware left sidebar + main content. Light ClickUp-style.
 */
const NAV = [
  { to: '/', label: 'Dashboard', Icon: IconDashboard, end: true },
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

  return (
    <div style={s.shell}>

      {/* ===== TOP BAR (full width) ===== */}
      <header style={s.topbar}>
        <div style={{ ...s.brand, width, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <img src="/logo.png" alt="Wizzgeeks" style={{ width: 26, height: 26, objectFit: 'contain' }} />
          {!collapsed && <span style={s.brandText}>Wizzgeeks</span>}
        </div>
        <button style={s.panelBtn} onClick={toggle} title="Toggle sidebar"><IconPanel size={18} /></button>

        <div style={s.searchArea}>
          <div style={s.searchBox} onClick={() => {}}>
            <span style={s.searchIcon}><IconSearch size={16} /></span>
            <span style={{ color: '#9ca3af' }}>Search...</span>
            <span style={s.kbd}>⌘K</span>
          </div>
        </div>

        <div style={s.topRight}>
          <NotificationBell />
          <button style={s.topIconBtn} title="Help"><IconHelp size={18} /></button>
          <UserMenu user={user} onProfile={() => navigate('/profile')} onLogout={() => dispatch(logout())} />
        </div>
      </header>

      {/* ===== BODY: sidebar + main ===== */}
      <div style={s.body}>
        <aside style={{ ...s.sidebar, width }}>
          <div style={s.navScroll}>
            <nav style={s.nav}>
              {NAV.filter((n) => !n.permission || can(n.permission)).map((n) => (
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
              ))}
              {can('project.read') && <SpacesMenu collapsed={collapsed} />}
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
            {!collapsed && <span style={{ color: '#9ca3af' }}><IconChevronDown size={14} /></span>}
          </button>
        </aside>

        <main style={s.main}><GlobalLoader /><Outlet /></main>
      </div>
    </div>
  );
}

/** Avatar button → dropdown with user info, Profile, and Log out. */
function UserMenu({ user, onProfile, onLogout }) {
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
          <button className="wg-menu-item" style={{ ...s.menuItem, color: '#b91c1c' }} onClick={() => { setOpen(false); onLogout(); }}>
            <span style={s.menuIcon}><IconLogout size={17} /></span> Log out
          </button>
        </div>
      )}
    </div>
  );
}

const s = {
  shell: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#fff' },

  // --- top bar ---
  topbar: { display: 'flex', alignItems: 'center', height: 56, flexShrink: 0,
    borderBottom: '1px solid #e5e7eb', background: '#fff', zIndex: 50 },
  brand: { display: 'flex', alignItems: 'center', gap: 8, height: '100%', padding: '0 14px',
    borderRight: '1px solid #e5e7eb', boxSizing: 'border-box', flexShrink: 0, overflow: 'hidden' },
  brandText: { fontWeight: 700, fontSize: 17, color: '#111827', whiteSpace: 'nowrap' },
  brandChevron: { color: '#9ca3af', display: 'inline-flex', marginLeft: 2 },
  panelBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38,
    margin: '0 6px', border: 'none', background: 'none', color: '#6b7280', borderRadius: 8, cursor: 'pointer' },
  searchArea: { flex: 1, display: 'flex', justifyContent: 'center', padding: '0 16px' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 480, height: 38,
    padding: '0 14px', background: '#f1f5f9', border: '1px solid transparent', borderRadius: 10, cursor: 'text', color: '#9ca3af', fontSize: 14 },
  searchIcon: { color: '#9ca3af', display: 'inline-flex' },
  kbd: { marginLeft: 'auto', fontSize: 12, color: '#9ca3af', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '1px 6px' },
  topRight: { display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 0 6px' },
  topIconBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36,
    border: 'none', background: 'none', color: '#6b7280', borderRadius: 8, cursor: 'pointer' },

  // --- body / sidebar ---
  body: { flex: 1, minHeight: 0, display: 'flex' },
  sidebar: { background: '#fff', color: '#334155', transition: 'width .2s cubic-bezier(.4,0,.2,1)',
    flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e5e7eb', overflow: 'hidden' },
  navScroll: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 10px' },
  nav: { display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box',
    padding: '9px 12px', borderRadius: 8, color: '#475569', textDecoration: 'none', fontSize: 14,
    fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden' },
  navItemCollapsed: { justifyContent: 'center', padding: '10px 0', gap: 0 },
  navActive: { background: '#f1f5f9', color: '#111827', fontWeight: 600 },
  navIcon: { width: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'inherit' },
  navLabel: { flex: 1 },

  // --- user chip ---
  userChip: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box',
    padding: '12px 14px', borderTop: '1px solid #e5e7eb', background: 'none', border: 'none', borderTopWidth: 1,
    borderTopStyle: 'solid', borderTopColor: '#e5e7eb', cursor: 'pointer', textAlign: 'left' },
  chipAvatar: { width: 32, height: 32, borderRadius: '50%', background: '#f59e0b', color: '#fff', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 },
  chipMeta: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
  chipName: { fontSize: 14, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  chipRole: { fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' },
  avatarBtn: { width: 30, height: 30, borderRadius: '50%', background: '#f59e0b', color: '#fff',
    border: '2px solid transparent', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center' },
  avatarBtnOpen: { borderColor: '#111827' },
  menu: { position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 280, background: '#fff',
    border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,.16)', zIndex: 70, overflow: 'hidden' },
  menuHead: { display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: '#f9fafb',
    borderBottom: '1px solid #f1f5f9' },
  menuAvatar: { width: 44, height: 44, borderRadius: '50%', background: '#f59e0b', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 },
  menuName: { fontWeight: 700, fontSize: 15, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  menuEmail: { fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  menuItem: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
    padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#374151' },
  menuIcon: { width: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'inherit' },
  main: { flex: 1, padding: 24, background: '#f9fafb', minWidth: 0, overflow: 'auto', position: 'relative' },
};
