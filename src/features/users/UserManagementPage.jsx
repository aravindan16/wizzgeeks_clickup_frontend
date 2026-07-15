import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usersApi } from './usersApi';
import UserModal from './UserModal';
import ResetPasswordModal from './ResetPasswordModal';
import { Pencil, Trash2, CircleCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { useHeaderSlot } from '../../layouts/headerSlot';
import Select from '../../components/Select';
import ResizableTable from '../../components/ResizableTable';
import { useConfirm } from '../../components/ConfirmDialog';

export default function UserManagementPage() {
  const { can } = useAuth();
  const confirm = useConfirm();
  const slotEl = useHeaderSlot();
  const [users, setUsers] = useState([]);      // the current page from the API
  const [total, setTotal] = useState(0);       // total matching rows (for the pager)
  const [page, setPage] = useState(0);         // 0-based
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roles, setRoles] = useState([]);
  const [modal, setModal] = useState({ open: false, mode: 'create', user: null });
  const [pwUser, setPwUser] = useState(null); // user whose password the admin is resetting

  // Server-side pagination: ask the backend for one page (skip/limit) + search/status.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { skip: page * pageSize, limit: pageSize };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      const res = await usersApi.list(params);
      setUsers(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter]);

  // Debounced fetch on any page/size/search/status change.
  useEffect(() => { const h = setTimeout(load, 200); return () => clearTimeout(h); }, [load]);
  // Reset to the first page when the filters change.
  useEffect(() => { setPage(0); }, [search, statusFilter]);
  useEffect(() => { usersApi.roles().then(setRoles).catch(() => setRoles([])); }, []);

  const toggleStatus = async (u) => {
    const disabling = u.status === 'active';
    const ok = await confirm({
      title: disabling ? `Disable ${u.full_name || 'user'}?` : `Activate ${u.full_name || 'user'}?`,
      message: disabling
        ? 'This user will be suspended and won’t be able to sign in until reactivated.'
        : 'This user will be able to sign in again.',
      confirmLabel: disabling ? 'Disable' : 'Activate',
      danger: disabling,
    });
    if (!ok) return;
    if (disabling) await usersApi.disable(u._id);
    else await usersApi.activate(u._id);
    load();
  };

  const columns = useMemo(() => [
    { key: 'name', label: 'Name', width: 180, render: (u) => <OverflowText text={u.full_name} /> },
    { key: 'email', label: 'Email', width: 240, render: (u) => <OverflowText text={u.email} /> },
    { key: 'roles', label: 'Roles', width: 150, render: (u) => <OverflowText text={(u.roles || []).join(', ')} /> },
    { key: 'status', label: 'Status', width: 110, render: (u) => (
      <span className={`badge ${u.status === 'active' ? 'badge-ok' : 'badge-err'}`}>{u.status}</span>
    ) },
    { key: 'actions', label: 'Actions', width: 140, render: (u) => (
      <div style={{ display: 'flex', gap: 4 }}>
        {can('user.update') && (
          <button className="icon-btn" style={s.iconBtn} title="Edit user"
            onClick={() => setModal({ open: true, mode: 'edit', user: u })}><Pencil size={16} /></button>
        )}
        {can('user.update') && (
          <button className="icon-btn" style={{ ...s.iconBtn, color: u.status === 'active' ? 'var(--c-danger, #dc2626)' : 'var(--c-success, #16a34a)' }}
            title={u.status === 'active' ? 'Disable user' : 'Activate user'} onClick={() => toggleStatus(u)}>
            {u.status === 'active' ? <Trash2 size={16} /> : <CircleCheck size={16} />}
          </button>
        )}
        {can('user.update') && (
          <button className="icon-btn" style={s.iconBtn} title="Reset password"
            onClick={() => setPwUser(u)}><KeyRound size={16} /></button>
        )}
      </div>
    ) },
  ], [can]);

  return (
    <div>
      {slotEl && createPortal(<span style={s.headerTitle}>User Management</span>, slotEl)}

      <div style={s.filters}>
        <input style={s.input} placeholder="Search name or email…" value={search}
          onChange={(e) => setSearch(e.target.value)} />
        <Select style={{ minWidth: 150 }} value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          options={[{ value: '', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]} />
        <span style={{ flex: 1 }} />
        {can('user.create') && (
          <button style={s.primary} onClick={() => setModal({ open: true, mode: 'create', user: null })}>
            + Create User
          </button>
        )}
      </div>

      {error && <p style={{ color: '#991b1b' }}>{error}</p>}

      <ResizableTable
        columns={columns}
        rows={users}
        rowKey={(u) => u._id}
        persistKey="wg-users-table"
        emptyText={loading ? 'Loading…' : 'No users found.'}
        serverMode
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={(n) => { setPageSize(n); setPage(0); }}
      />

      <UserModal
        open={modal.open}
        mode={modal.mode}
        user={modal.user}
        roles={roles}
        onClose={() => setModal({ ...modal, open: false })}
        onSaved={() => { setModal({ ...modal, open: false }); load(); }}
      />

      <ResetPasswordModal
        open={!!pwUser}
        user={pwUser}
        onClose={() => setPwUser(null)}
      />
    </div>
  );
}

// Table cell that ellipsises its text and shows a tooltip with the full value
// ONLY when the text is actually truncated. Measured at hover time (reliable) and
// portaled to body so it can't be clipped by the table's overflow.
function OverflowText({ text }) {
  const ref = useRef(null);
  const [tip, setTip] = useState(null); // { x, y }
  const onEnter = () => {
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const r = el.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2, y: r.top });
  };
  return (
    <>
      <span ref={ref} onMouseEnter={onEnter} onMouseLeave={() => setTip(null)}
        style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
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
  headerTitle: { fontSize: 16, fontWeight: 700, color: 'var(--c-text-strong)' },
  filters: { display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' },
  input: { padding: '8px 11px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)',
    color: 'var(--c-text-strong)', outline: 'none', minWidth: 240 },
  primary: { padding: '9px 16px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none',
    borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  iconBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30,
    background: 'none', border: 'none', borderRadius: 7, color: 'var(--c-muted)', cursor: 'pointer' },
};
