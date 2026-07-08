import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { usersApi } from './usersApi';
import UserModal from './UserModal';
import ResetPasswordModal from './ResetPasswordModal';
import { Pencil, Trash2, CircleCheck, KeyRound } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { useHeaderSlot } from '../../layouts/headerSlot';
import Select from '../../components/Select';
import ResizableTable from '../../components/ResizableTable';

export default function UserManagementPage() {
  const { can } = useAuth();
  const slotEl = useHeaderSlot();
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roles, setRoles] = useState([]);
  const [modal, setModal] = useState({ open: false, mode: 'create', user: null });
  const [pwUser, setPwUser] = useState(null); // user whose password the admin is resetting

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await usersApi.list({ skip: 0, limit: 200 });
      setAllUsers(res.items || []);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { usersApi.roles().then(setRoles).catch(() => setRoles([])); }, []);

  const toggleStatus = async (u) => {
    if (u.status === 'active') await usersApi.disable(u._id);
    else await usersApi.activate(u._id);
    load();
  };

  // Live client-side search + status filter (no Search button).
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allUsers.filter((u) => {
      if (statusFilter && u.status !== statusFilter) return false;
      if (!q) return true;
      return (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
    });
  }, [allUsers, search, statusFilter]);

  const columns = useMemo(() => [
    { key: 'name', label: 'Name', width: 180, render: (u) => u.full_name },
    { key: 'email', label: 'Email', width: 240, render: (u) => u.email },
    { key: 'roles', label: 'Roles', width: 150, render: (u) => (u.roles || []).join(', ') },
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
        rows={rows}
        rowKey={(u) => u._id}
        persistKey="wg-users-table"
        emptyText={loading ? 'Loading…' : 'No users found.'}
        defaultPageSize={10}
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
