import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsApi, PROJECT_STATUSES } from './projectsApi';
import SpaceSetupModal from './SpaceSetupModal';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { IconSearch, IconStar } from '../../components/icons';
import Select from '../../components/Select';
import { useStarred } from '../starred/useStarred';
import { starItem, unstarItem } from '../starred/starredStore';

const PAGE_SIZE = 10;

const initials = (name) => (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function ProjectListPage() {
  const { can, user } = useAuth();
  const me = user?._id || user?.id;
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [setupOpen, setSetupOpen] = useState(false);
  const [menu, setMenu] = useState(null); // { id, x, y }
  const starredItems = useStarred('space');
  const starredIds = new Set(starredItems.map((i) => i.entity_id));

  const load = useCallback(async () => {
    setLoading(true);
    const params = { skip: page * PAGE_SIZE, limit: PAGE_SIZE };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    const res = await projectsApi.list(params);
    setData(res);
    setLoading(false);
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const toggleStar = (e, p) => {
    e.stopPropagation();
    if (starredIds.has(p._id)) {
      unstarItem('space', p._id);
    } else {
      starItem({ entity_type: 'space', entity_id: p._id, path: `/projects/${p._id}`, name: p.name, icon: '📁' });
    }
  };

  // Starred spaces float to the top of the current page.
  const rows = [...data.items].sort((a, b) => (starredIds.has(b._id) ? 1 : 0) - (starredIds.has(a._id) ? 1 : 0));
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
  };

  return (
    <div>
      <div style={s.header}>
        <h2 style={{ margin: 0 }}>Spaces</h2>
        {can('project.create') && (
          <button style={s.primary} onClick={() => setSetupOpen(true)}>Create space</button>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); setPage(0); load(); }} style={s.filters}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <span style={s.searchIcon}><IconSearch size={15} /></span>
          <input style={{ ...s.input, paddingLeft: 32, width: '100%', boxSizing: 'border-box' }}
            placeholder="Search spaces" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select style={{ minWidth: 170 }} value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(0); }}
          options={[{ value: '', label: 'Filter by status' }, ...PROJECT_STATUSES.map((st) => ({ value: st, label: st }))]} />
      </form>

      <div className="card" style={{ maxWidth: '100%', padding: 0, overflow: 'auto' }}>
        <table style={s.table}>
          <thead>
            <tr>
              <Th style={{ width: 40 }}>★</Th>
              <Th>Name</Th><Th>Key</Th><Th>Type</Th><Th>Lead</Th><Th>Space URL</Th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={s.empty}>Loading…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} style={s.empty}>
                <div style={{ marginBottom: 12 }}>No spaces yet.</div>
                {can('project.create') && (
                  <button style={s.primary} onClick={() => setSetupOpen(true)}>Create space</button>
                )}
              </td></tr>
            )}
            {!loading && rows.map((p) => (
              <tr key={p._id} style={s.row} onClick={() => navigate(`/projects/${p._id}`)}>
                <Td>
                  <button style={{ ...s.star, color: starredIds.has(p._id) ? '#111827' : '#cbd5e1' }}
                    onClick={(e) => toggleStar(e, p)} title="Star">
                    <IconStar size={16} />
                  </button>
                </Td>
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
                    <button style={s.dots} onClick={(e) => openMenu(e, p._id)} title="Actions">⋯</button>
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
          <div style={{ ...s.menu, top: menu.y + 4, left: menu.x - 168 }}>
            <button style={s.menuItem} onClick={() => { setMenu(null); navigate(`/projects/${menu.id}`); }}>
              Open
            </button>
            {canArchive(menuProject) && menuProject.status !== 'archived' && (
              <button style={s.menuItem} onClick={doArchive}>Archive</button>
            )}
            {canDelete(menuProject) && (
              <button style={{ ...s.menuItem, color: '#b91c1c' }} onClick={doDelete}>Delete</button>
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

const thStyle = { textAlign: 'left', padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#374151', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' };
const tdStyle = { padding: '12px 16px', fontSize: 14, borderBottom: '1px solid #f1f5f9' };

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  filters: { display: 'flex', gap: 10, marginBottom: 16 },
  input: { padding: '8px 11px', border: '1px solid #d1d5db', borderRadius: 8 },
  searchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'inline-flex' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff' },
  row: { cursor: 'pointer' },
  empty: { padding: 28, textAlign: 'center', color: '#6b7280' },
  star: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center' },
  nameCell: { display: 'flex', alignItems: 'center', gap: 10 },
  spaceIcon: { width: 26, height: 26, borderRadius: 6, background: '#111827', color: '#ffffff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 },
  nameLink: { color: '#111827', fontWeight: 600 },
  leadCell: { display: 'flex', alignItems: 'center', gap: 8 },
  avatar: { width: 26, height: 26, borderRadius: '50%', background: '#f59e0b', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 },
  url: { color: '#6b7280', fontSize: 13 },
  dots: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6b7280',
    padding: '0 6px', borderRadius: 6, lineHeight: 1 },
  menuBackdrop: { position: 'fixed', inset: 0, zIndex: 300 },
  menu: { position: 'fixed', width: 160, background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: 8, boxShadow: '0 10px 28px rgba(0,0,0,.18)', zIndex: 301, padding: 4 },
  menuItem: { display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
    padding: '9px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 14, color: '#111827' },
  pager: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 },
  pageBtn: { width: 32, height: 32, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' },
  pageNum: { width: 32, height: 32, borderRadius: 6, border: '1px solid #111827', color: '#111827',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 },
  primary: { padding: '9px 18px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
};
