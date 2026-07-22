import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout } from '../features/auth/authSlice';
import { useAuth } from '../features/auth/useAuth';
import SpacesMenu from '../features/spaces/SpacesMenu';
import DashboardsMenu from '../features/dashboard/DashboardsMenu';
import FiltersMenu from '../features/filters/FiltersMenu';
import NotificationBell from '../features/notifications/NotificationBell';
import { HeaderSlotContext } from './headerSlot';
import {
  IconMembers, IconSettings,
  IconHelp, IconChevronDown, IconPanel, IconUser, IconLogout,
} from '../components/icons';
import { ShieldCheck } from 'lucide-react';
import ThemeCustomizer from '../components/ThemeCustomizer';
import { syncFromUser } from '../services/theme';

// Sidebar Permission glyph — Lucide, tuned to the app's 1.9 stroke.
const IconPermission = ({ size = 18 }) => <ShieldCheck size={size} strokeWidth={1.9} />;

/**
 * Application shell: a full-width top bar (brand · search · actions) over a
 * collapsible, permission-aware left sidebar + main content. Light ClickUp-style.
 */
const NAV = [
  { to: '/users', label: 'Users', Icon: IconMembers, permission: 'user.read' },
  { to: '/settings', label: 'Settings', Icon: IconSettings, permission: 'admin.settings' },
  { to: '/permissions', label: 'Permission setting', Icon: IconPermission, permission: 'permission.manage' },
];

const STORAGE_KEY = 'wg_sidebar_collapsed';

const initials = (n) => (n || '?').split(/[\s@.]+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
// "super_admin" → "Super admin" for a friendlier role label.
const prettyRole = (r) => (r || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export default function AppLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [slotEl, setSlotEl] = useState(null); // topbar node pages portal their breadcrumb into

  // Restore the user's DB-stored theme/accent on login (follows them across devices).
  // Keyed on user id too, so switching accounts always re-applies even when the two
  // users' theme/accent values happen to coincide.
  useEffect(() => { syncFromUser(user); }, [user?.id, user?._id, user?.theme, user?.accent]);

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
        <div style={{ ...s.brand, width, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <div style={s.brandLeft}>
            <img src="/logo.png" alt="Taskmanager" style={{ width: 26, height: 26, objectFit: 'contain' }} />
            {!collapsed && <span style={s.brandText}>Taskmanager</span>}
          </div>
        </div>

        {/* Page breadcrumb/title portals in here (fills the left side of the topbar). */}
        <div style={s.headerSlot} ref={setSlotEl} />

        <div style={s.topRight}>
          <NotificationBell />
        </div>
      </header>

      {/* ===== BODY: sidebar + main ===== */}
      <div style={s.body}>
        {/* Collapsed: allow hover tooltips (icons only, so labels aren't visible).
            Expanded: suppress them — the text labels are already shown. */}
        <aside style={{ ...s.sidebar, width }} {...(collapsed ? {} : { 'data-no-tip': true })}>
          <div style={s.navScroll}>
            <nav style={s.nav}>
              <DashboardsMenu collapsed={collapsed} />
              {can('project.read') && <SpacesMenu collapsed={collapsed} />}
              {can('task.read') && <FiltersMenu collapsed={collapsed} />}
              {NAV.filter((n) => !n.permission || can(n.permission)).map(renderNav)}
            </nav>
          </div>

          {/* Footer: signed-in user chip → the SAME dropdown (Profile/Customize/
              Log out) as the top-bar avatar, opening upward; plus the collapse toggle. */}
          <div style={{ ...s.sidebarFooter, flexDirection: collapsed ? 'column-reverse' : 'row', gap: collapsed ? 6 : 4 }}>
            <UserMenu user={user} variant="chip" collapsed={collapsed} placement="up"
              onProfile={() => navigate('/profile')} onLogout={() => dispatch(logout())}
              onCustomize={() => setCustomizeOpen(true)} />
            <button className="wg-user-chip" style={s.panelBtn} onClick={(e) => { e.currentTarget.blur(); toggle(); }}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <IconPanel size={18} />
            </button>
          </div>
        </aside>

        <main style={s.main}>
          <HeaderSlotContext.Provider value={slotEl}><Outlet /></HeaderSlotContext.Provider>
        </main>
      </div>

      <ThemeCustomizer open={customizeOpen} onClose={() => setCustomizeOpen(false)} />
    </div>
  );
}

/**
 * Avatar → dropdown with user info, Profile, Customize, and Log out.
 * variant="avatar" (top bar, round button, opens down-right) or
 * variant="chip" (sidebar footer, avatar+name+role, opens up-left).
 */
function UserMenu({ user, onProfile, onLogout, onCustomize, variant = 'avatar', collapsed = false, placement = 'down' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // fixed coords for the portaled chip menu
  const ref = useRef(null);             // trigger wrapper (outside-click anchor)
  const menuRef = useRef(null);         // portaled menu (also counts as "inside")
  const isChip = variant === 'chip';

  useEffect(() => {
    if (!open) return undefined;
    // The chip menu is portaled to <body>, so treat clicks inside it as inside too.
    const onClick = (e) => {
      if (ref.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onEsc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  // The sidebar sits inside an overflow:hidden aside, so the chip menu is portaled
  // to <body> and positioned (fixed) above-left of the trigger — never clipped.
  useEffect(() => {
    if (!open || !isChip) return undefined;
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (r) setPos({ left: r.left, bottom: window.innerHeight - r.top + 8 });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, isChip]);

  const avatar = (
    <span style={{ ...s.chipAvatar, background: user?.avatar_color || s.chipAvatar.background, overflow: 'hidden' }}>
      {user?.avatar_url
        ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials(user?.full_name)}
    </span>
  );

  // The three actions are shared by both variants' dropdowns.
  const menuActions = (
    <div style={s.menuActions}>
      <button className="wg-menu-item" style={s.menuItem} onClick={() => { setOpen(false); onProfile(); }}>
        <span style={s.menuIcon}><IconUser size={16} /></span> Profile
      </button>
      <button className="wg-menu-item" style={s.menuItem} onClick={() => { setOpen(false); onCustomize(); }}>
        <span style={s.menuIcon}><IconSettings size={16} /></span> Customize
      </button>
      <button className="wg-menu-item" style={{ ...s.menuItem, color: '#ef4444' }} onClick={() => { setOpen(false); onLogout(); }}>
        <span style={s.menuIcon}><IconLogout size={16} /></span> Log out
      </button>
    </div>
  );

  return (
    <div style={{ position: 'relative', ...(isChip ? { flex: collapsed ? '0 0 auto' : 1, minWidth: 0 } : {}) }} ref={ref}>
      {isChip ? (
        <button className="wg-user-chip"
          style={{ ...s.userChip, width: '100%', justifyContent: collapsed ? 'center' : 'flex-start' }}
          onClick={() => setOpen((o) => !o)}>
          {avatar}
          {!collapsed && (
            <span style={s.chipMeta}>
              <OverflowName text={user?.full_name || 'User'} style={s.chipName} />
              {(user?.roles || [])[0] && <span style={s.chipRole}>{prettyRole((user.roles || [])[0])}</span>}
            </span>
          )}
        </button>
      ) : (
        <button style={{ ...s.avatarBtn, background: user?.avatar_color || s.avatarBtn.background, overflow: 'hidden' }}
          aria-label={user?.full_name} onClick={() => setOpen((o) => !o)}>
          {user?.avatar_url
            ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials(user?.full_name)}
        </button>
      )}
      {open && !isChip && (
        <div style={{ ...s.menu, ...(placement === 'up' ? s.menuUp : {}) }}>
          <div style={s.menuHead}>
            <span style={{ ...s.menuAvatar, background: user?.avatar_color || s.menuAvatar.background, overflow: 'hidden' }}>
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials(user?.full_name)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={s.menuName}>{user?.full_name || 'User'}</div>
              <div style={s.menuEmail}>{user?.email}</div>
            </div>
          </div>
          {menuActions}
        </div>
      )}
      {/* Chip menu (sidebar footer): portaled to <body>, fixed above-left of the chip,
          actions only (the chip already shows the name/avatar). */}
      {open && isChip && pos && createPortal(
        <div ref={menuRef} style={{ ...s.menu, position: 'fixed', top: 'auto', right: 'auto', left: pos.left, bottom: pos.bottom, width: 200 }}>
          {menuActions}
        </div>,
        document.body,
      )}
    </div>
  );
}

// Renders text with an ellipsis; a tooltip appears ONLY when the text is actually
// truncated (so short names don't get a redundant tooltip). Measured at hover time
// — reliable regardless of when flex layout settles — and portaled so it can't clip.
function OverflowName({ text, style }) {
  const ref = useRef(null);
  const [tip, setTip] = useState(null); // { x, y }
  const onEnter = () => {
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth) return; // not truncated → no tooltip
    const r = el.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2, y: r.top });
  };
  return (
    <>
      <span ref={ref} style={style} onMouseEnter={onEnter} onMouseLeave={() => setTip(null)}>{text}</span>
      {tip && createPortal(
        <div style={{ position: 'fixed', left: tip.x, top: tip.y, transform: 'translate(-50%, -125%)',
          pointerEvents: 'none', background: 'var(--c-text-strong)', color: 'var(--c-surface)',
          padding: '5px 9px', borderRadius: 7, fontSize: 12, lineHeight: 1.25, whiteSpace: 'nowrap',
          boxShadow: '0 4px 14px rgba(0,0,0,.22)', zIndex: 9999 }}>{text}</div>,
        document.body,
      )}
    </>
  );
}

const s = {
  shell: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--c-surface)' },

  // --- top bar ---
  topbar: { display: 'flex', alignItems: 'center', height: 56, flexShrink: 0,
    borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface)', zIndex: 50 },
  brand: { display: 'flex', alignItems: 'center', gap: 8, height: '100%', padding: '0 14px',
    borderRight: '1px solid var(--c-border)', boxSizing: 'border-box', flexShrink: 0, overflow: 'hidden',
    transition: 'width .32s cubic-bezier(.4,0,.2,1)' },
  brandLeft: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  brandText: { fontWeight: 700, fontSize: 17, color: 'var(--c-text-strong)', whiteSpace: 'nowrap' },
  brandChevron: { color: 'var(--c-faint)', display: 'inline-flex', marginLeft: 2 },
  panelBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34,
    flexShrink: 0, border: 'none', background: 'none', color: 'var(--c-muted)', borderRadius: 8, cursor: 'pointer',
    outline: 'none', transition: 'background .12s' },
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
  sidebar: { background: 'var(--c-surface)', color: 'var(--c-text)', transition: 'width .32s cubic-bezier(.4,0,.2,1)',
    flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--c-border)', overflow: 'hidden' },
  navScroll: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 10px' },
  nav: { display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box',
    padding: '9px 8px', borderRadius: 8, color: 'var(--c-muted)', textDecoration: 'none', fontSize: 14,
    fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden' },
  navItemCollapsed: { justifyContent: 'center', padding: '10px 0', gap: 0 },
  navActive: { background: 'var(--c-hover)', color: 'var(--c-text-strong)', fontWeight: 600 },
  navIcon: { width: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'inherit' },
  navLabel: { flex: 1 },

  sidebarFooter: { display: 'flex', alignItems: 'center', padding: 8 },

  // --- user chip ---
  userChip: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, boxSizing: 'border-box',
    padding: '8px 10px', background: 'none', border: 'none', borderRadius: 10, outline: 'none',
    cursor: 'pointer', textAlign: 'left', transition: 'background .12s' },
  chipAvatar: { width: 34, height: 34, borderRadius: '50%', background: '#f59e0b', color: '#fff', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 },
  chipMeta: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, gap: 1 },
  chipName: { fontSize: 13.5, fontWeight: 600, color: 'var(--c-text-strong)', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  chipRole: { fontSize: 11.5, color: 'var(--c-faint)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  avatarBtn: { width: 30, height: 30, borderRadius: '50%', background: '#f59e0b', color: '#fff',
    border: '2px solid transparent', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center' },
  avatarBtnOpen: { borderColor: 'var(--c-text-strong)' },
  menu: { position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 240, background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,.16)', zIndex: 70, overflow: 'hidden' },
  // Sidebar-footer variant: open UP and align to the LEFT edge of the chip.
  menuUp: { top: 'auto', bottom: 'calc(100% + 8px)' },
  menuChip: { left: 0, right: 'auto', width: 260 },
  menuHead: { display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'var(--c-surface-2)',
    borderBottom: '1px solid var(--c-border-2)' },
  menuAvatar: { width: 44, height: 44, borderRadius: '50%', background: '#f59e0b', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 },
  menuName: { fontWeight: 700, fontSize: 15, color: 'var(--c-text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  menuEmail: { fontSize: 13, color: 'var(--c-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  // Inset, padded container so each item's hover highlight is a rounded pill (like the
  // Spaces "…" menu) instead of an edge-to-edge bar.
  menuActions: { padding: 6 },
  menuItem: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
    padding: '9px 11px', borderRadius: 8, cursor: 'pointer', fontSize: 13.5, fontWeight: 500,
    color: 'var(--c-text)', lineHeight: 1.2 },
  menuIcon: { width: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'inherit', flexShrink: 0 },
  main: { flex: 1, padding: 24, background: 'var(--c-surface-2)', minWidth: 0, overflow: 'auto', position: 'relative' },
};
