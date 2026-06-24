import { useCallback, useEffect, useState } from 'react';
import { usersApi } from './usersApi';
import UserModal from './UserModal';
import { useAuth } from '../auth/useAuth';
import Select from '../../components/Select';

const PAGE_SIZE = 10;

export default function UserManagementPage() {
  const { can } = useAuth();
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [roles, setRoles] = useState([]);
  const [modal, setModal] = useState({ open: false, mode: 'create', user: null });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { skip: page * PAGE_SIZE, limit: PAGE_SIZE };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await usersApi.list(params);
      setData(res);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    usersApi.roles().then(setRoles).catch(() => setRoles([]));
  }, []);

  const onSearchSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    load();
  };

  const toggleStatus = async (u) => {
    if (u.status === 'active') await usersApi.disable(u._id);
    else await usersApi.activate(u._id);
    load();
  };

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div>
      <div style={s.header}>
        <h2 style={{ margin: 0 }}>User Management</h2>
        {can('user.create') && (
          <button style={s.primary} onClick={() => setModal({ open: true, mode: 'create', user: null })}>
            + Create User
          </button>
        )}
      </div>

      <form onSubmit={onSearchSubmit} style={s.filters}>
        <input style={s.input} placeholder="Search name or email…" value={search}
          onChange={(e) => setSearch(e.target.value)} />
        <Select style={{ minWidth: 150 }} value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(0); }}
          options={[{ value: '', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]} />
        <button style={s.ghost} type="submit">Search</button>
      </form>

      {error && <p style={{ color: '#991b1b' }}>{error}</p>}

      <div className="card" style={{ maxWidth: '100%', padding: 0, overflow: 'hidden' }}>
        <table style={s.table}>
          <thead>
            <tr>
              <Th>Name</Th><Th>Email</Th><Th>Roles</Th><Th>Department</Th><Th>Status</Th><Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={s.empty}>Loading…</td></tr>
            )}
            {!loading && data.items.length === 0 && (
              <tr><td colSpan={6} style={s.empty}>No users found.</td></tr>
            )}
            {!loading && data.items.map((u) => (
              <tr key={u._id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <Td>{u.full_name}</Td>
                <Td>{u.email}</Td>
                <Td>{(u.roles || []).join(', ')}</Td>
                <Td>{u.department || '—'}</Td>
                <Td>
                  <span className={`badge ${u.status === 'active' ? 'badge-ok' : 'badge-err'}`}>
                    {u.status}
                  </span>
                </Td>
                <Td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {can('user.update') && (
                      <button style={s.link} onClick={() => setModal({ open: true, mode: 'edit', user: u })}>
                        Edit
                      </button>
                    )}
                    {can('user.update') && (
                      <button style={s.link} onClick={() => toggleStatus(u)}>
                        {u.status === 'active' ? 'Disable' : 'Activate'}
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={s.pager}>
        <span>{data.total} users · page {page + 1} of {totalPages}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={s.ghost} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <button style={s.ghost} disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>

      <UserModal
        open={modal.open}
        mode={modal.mode}
        user={modal.user}
        roles={roles}
        onClose={() => setModal({ ...modal, open: false })}
        onSaved={() => { setModal({ ...modal, open: false }); load(); }}
      />
    </div>
  );
}

const Th = ({ children }) => <th style={s.th}>{children}</th>;
const Td = ({ children }) => <td style={s.td}>{children}</td>;

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  filters: { display: 'flex', gap: 8, marginBottom: 16 },
  input: { padding: '8px 11px', border: '1px solid #d1d5db', borderRadius: 8 },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff' },
  th: { textAlign: 'left', padding: '12px 14px', fontSize: 12, textTransform: 'uppercase',
    color: '#6b7280', background: '#f9fafb' },
  td: { padding: '12px 14px', fontSize: 14 },
  empty: { padding: 24, textAlign: 'center', color: '#6b7280' },
  primary: { padding: '9px 16px', background: '#111827', color: '#fff', border: 'none',
    borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  ghost: { padding: '8px 14px', background: '#fff', border: '1px solid #d1d5db',
    borderRadius: 8, cursor: 'pointer' },
  link: { background: 'none', border: 'none', color: '#111827', cursor: 'pointer', fontSize: 14, padding: 0 },
  pager: { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, color: '#6b7280', fontSize: 14 },
};
