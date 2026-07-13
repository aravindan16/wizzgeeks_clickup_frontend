import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useHeaderSlot } from '../../layouts/headerSlot';
import { projectsApi } from './projectsApi';
import SpaceSetupModal from './SpaceSetupModal';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { IconSearch, IconExpand, IconTrash } from '../../components/icons';

const PAGE_SIZE = 10;

const initials = (name) => (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function ProjectListPage() {
  const { can, user } = useAuth();
  const me = user?._id || user?.id;
  const navigate = useNavigate();
  const slotEl = useHeaderSlot();
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [setupOpen, setSetupOpen] = useState(false);
  const [menu, setMenu] = useState(null); // { id, x, y }

  const load = useCallback(async () => {
    setLoading(true);
    const params = { skip: page * PAGE_SIZE, limit: PAGE_SIZE };
    if (search) params.search = search;
    const res = await projectsApi.list(params);
    setData(res);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const rows = data.items;
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  const openMenu = (e, id) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setMenu(menu?.id === id ? null : { id, x: r.right, y: r.bottom });
  };
  const menuProject = menu ? rows.find((p) => p._id === menu.id) : null;
  const isOwner = (p) => p && p.owner_id && p.owner_id === me;
  const canArchive = (p) => can('project.update') || isOwner(p);
  const canDelete = (p) => can('project.delete') || isOwner(p);

  const doArchive = async () => {
    setMenu(null);
    await projectsApi.archive(menuProject._id);
    toast.success('Space archived');
    load();
  };
  const doDelete = async () => {
    const p = menuProject;
    setMenu(null);
    const ok = await confirm({
      title: `Delete: ${p.name}`,
      message: 'This Space and all of its Lists and tasks will be deleted. This cannot be undone.',
    });
    if (!ok) return;
    await projectsApi.remove(p._id);
    toast.success('Space deleted');
    load();
    // Refresh the sidebar Spaces list too, wherever the delete happened.
    window.dispatchEvent(new CustomEvent('wg:spaces-changed'));
  };

  return (
    <div>
      {slotEl && createPortal(<span style={s.headerTitle}>Spaces</span>, slotEl)}

      <div style={s.toolbar}>
        <form onSubmit={(e) => { e.preventDefault(); setPage(0); load(); }} style={s.searchForm}>
          <span style={s.searchIcon}><IconSearch size={15} /></span>
          <input style={{ ...s.input, paddingLeft: 32, width: '100%', boxSizing: 'border-box' }}
            placeholder="Search spaces" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        {can('project.create') && (
          <button style={s.primary} onClick={() => setSetupOpen(true)}>Create space</button>
        )}
      </div>

      <div className="card" style={{ maxWidth: '100%', padding: 0, overflow: 'auto' }}>
        <table style={s.table}>
          <thead>
            <tr>
              <Th>Name</Th><Th>Key</Th><Th>Type</Th><Th>Lead</Th><Th>Space URL</Th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={s.empty}>Loading…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} style={s.empty}>
                <div style={{ marginBottom: 12 }}>No spaces yet.</div>
                {can('project.create') && (
                  <button style={s.primary} onClick={() => setSetupOpen(true)}>Create space</button>
                )}
              </td></tr>
            )}
            {!loading && rows.map((p) => (
              <tr key={p._id} className="wg-row-hover" style={s.row} onClick={() => navigate(`/projects/${p._id}`)}>
                <Td>
                  <div style={s.nameCell}>
                    <span style={s.spaceIcon}>{p.key?.[0] || 'S'}</span>
                    <span style={s.nameLink}>{p.name}</span>
                  </div>
                </Td>
                <Td>{p.key}</Td>
                <Td><span style={{ color: '#374151' }}>Team-managed software</span></Td>
                <Td>
                  <div style={s.leadCell}>
                    <span style={s.avatar}>{initials(p.owner_name)}</span>
                    <span>{p.owner_name || '—'}</span>
                  </div>
                </Td>
                <Td>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={s.url}>/projects/{p.key}</span>
                    <button className="icon-btn" style={s.dots} onClick={(e) => openMenu(e, p._id)} title="Actions">⋯</button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Row actions menu (fixed-positioned so it escapes the table's scroll area) */}
      {menu && menuProject && (
        <>
          <div style={s.menuBackdrop} onClick={() => setMenu(null)} />
          <div style={{ ...s.menu, top: menu.y + 6, left: menu.x - 180 }}>
            <button className="wg-menu-item" style={s.menuItem} onClick={() => { setMenu(null); navigate(`/projects/${menu.id}`); }}>
              <span style={s.menuIcon}><IconExpand size={15} /></span> Open
            </button>
            {canDelete(menuProject) && (
              <>
                <div style={s.menuDivider} />
                <button className="wg-menu-item" style={{ ...s.menuItem, color: '#dc2626' }} onClick={doDelete}>
                  <span style={{ ...s.menuIcon, color: '#dc2626' }}><IconTrash size={15} /></span> Delete
                </button>
              </>
            )}
          </div>
        </>
      )}

      <div style={s.pager}>
        <button style={s.pageBtn} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</button>
        <span style={s.pageNum}>{page + 1}</span>
        <button style={s.pageBtn} disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
      </div>

      <SpaceSetupModal open={setupOpen} onClose={() => setSetupOpen(false)} onCreated={load} />
    </div>
  );
}

const Th = ({ children, style }) => <th style={{ ...thStyle, ...style }}>{children}</th>;
const Td = ({ children }) => <td style={tdStyle}>{children}</td>;

const thStyle = { textAlign: 'left', padding: '12px 16px', fontSize: 12, fontWeight: 600, letterSpacing: '.02em',
  color: 'var(--c-muted)', background: 'var(--c-surface-2)', borderBottom: '1px solid var(--c-border)' };
const tdStyle = { padding: '12px 16px', fontSize: 14, color: 'var(--c-text)', borderBottom: '1px solid var(--c-border-2)' };

const s = {
  headerTitle: { fontSize: 16, fontWeight: 700, color: 'var(--c-text-strong)' },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  searchForm: { position: 'relative', flex: 1, maxWidth: 360 },
  input: { padding: '8px 11px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)', color: 'var(--c-text)' },
  searchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'inline-flex' },
  table: { width: '100%', borderCollapse: 'collapse', background: 'var(--c-surface)' },
  row: { cursor: 'pointer' },
  empty: { padding: 28, textAlign: 'center', color: '#6b7280' },
  star: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center' },
  nameCell: { display: 'flex', alignItems: 'center', gap: 10 },
  spaceIcon: { width: 26, height: 26, borderRadius: 6, background: 'var(--c-primary)', color: 'var(--c-on-primary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 },
  nameLink: { color: '#111827', fontWeight: 600 },
  leadCell: { display: 'flex', alignItems: 'center', gap: 8 },
  avatar: { width: 26, height: 26, borderRadius: '50%', background: '#f59e0b', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 },
  url: { color: '#6b7280', fontSize: 13 },
  dots: { fontSize: 20, lineHeight: 1, width: 30, height: 30 },
  menuBackdrop: { position: 'fixed', inset: 0, zIndex: 300 },
  menu: { position: 'fixed', width: 180, background: 'var(--c-surface)', border: '1px solid var(--c-border)',
    borderRadius: 12, boxShadow: '0 16px 40px rgba(16,24,40,.18)', zIndex: 301, padding: 6 },
  menuItem: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box', textAlign: 'left',
    border: 'none', padding: '9px 11px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: 'var(--c-text)' },
  menuIcon: { display: 'inline-flex', color: 'var(--c-muted)' },
  menuDivider: { height: 1, background: 'var(--c-border-2)', margin: '5px 0' },
  pager: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 },
  pageBtn: { width: 32, height: 32, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' },
  pageNum: { width: 32, height: 32, borderRadius: 6, border: '1px solid #111827', color: '#111827',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 },
  primary: { padding: '9px 18px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
};
