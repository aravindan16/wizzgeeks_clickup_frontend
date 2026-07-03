import { useEffect, useMemo, useState } from 'react';
import { dashboardsApi } from './dashboardsApi';
import { useToast } from '../../components/Toast';
import { IconClose, IconTrash, IconSearch, IconPlus } from '../../components/icons';

const initials = (n) => (n || '?').split(/[\s@.]+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/** Share a dashboard with other users (owner-managed member list). */
export default function DashboardShareModal({ open, dashboardId, onClose, onChanged }) {
  const toast = useToast();
  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !dashboardId) return;
    setQuery('');
    dashboardsApi.members(dashboardId).then((r) => setMembers(r.items || [])).catch(() => setMembers([]));
  }, [open, dashboardId]);

  // Server-side user search (accessible to any authenticated user), debounced.
  useEffect(() => {
    if (!open) return undefined;
    const h = setTimeout(() => {
      dashboardsApi.searchUsers(query).then((r) => setUsers(r.items || [])).catch(() => setUsers([]));
    }, 200);
    return () => clearTimeout(h);
  }, [open, query]);

  const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
  const candidates = useMemo(
    () => users.filter((u) => !memberIds.has(u.user_id)).slice(0, 30),
    [users, memberIds],
  );

  const apply = (items) => { setMembers(items); onChanged?.(); window.dispatchEvent(new Event('wg-dashboards-changed')); };

  const add = async (u) => {
    setBusy(true);
    try { const r = await dashboardsApi.addMember(dashboardId, u.user_id); apply(r.items || []); toast.success(`Added ${u.full_name || u.email}`); }
    catch { toast.error('Could not add member'); } finally { setBusy(false); }
  };
  const remove = async (m) => {
    setBusy(true);
    try { const r = await dashboardsApi.removeMember(dashboardId, m.user_id); apply(r.items || []); }
    catch { toast.error('Could not remove member'); } finally { setBusy(false); }
  };

  if (!open) return null;
  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <h3 style={s.title}>Share dashboard</h3>
          <button className="icon-btn" style={s.close} onClick={onClose} aria-label="Close"><IconClose size={18} /></button>
        </div>

        <div className="wg-search-box" style={s.searchWrap}>
          <span style={s.searchIcon}><IconSearch size={16} /></span>
          <input autoFocus style={s.search} placeholder="Search people to add…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {query && (
          <div style={s.results}>
            {candidates.length === 0 && <div style={s.empty}>No people found</div>}
            {candidates.map((u) => (
              <button key={u.user_id} className="wg-menu-item" style={s.result} disabled={busy} onClick={() => add(u)}>
                <span style={s.avatar}>{initials(u.full_name)}</span>
                <span style={s.userMeta}>
                  <span style={s.userName}>{u.full_name}</span>
                  <span style={s.userEmail}>{u.email}</span>
                </span>
                <span style={s.addIcon}><IconPlus size={16} /></span>
              </button>
            ))}
          </div>
        )}

        <div style={s.sectionLabel}>People with access</div>
        <div style={s.memberList}>
          {members.map((m) => (
            <div key={m.user_id} style={s.memberRow}>
              <span style={s.avatar}>{initials(m.full_name)}</span>
              <span style={s.userMeta}>
                <span style={s.userName}>{m.full_name || m.email}</span>
                <span style={s.userEmail}>{m.email}</span>
              </span>
              {m.is_owner
                ? <span style={s.ownerBadge}>Owner</span>
                : <button className="icon-btn" style={s.removeBtn} title="Remove" disabled={busy} onClick={() => remove(m)}><IconTrash size={15} /></button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: 'var(--c-surface)', color: 'var(--c-text)', borderRadius: 14, padding: 22, width: 460, maxWidth: '95vw', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,.3)' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--c-text-strong)' },
  close: { color: 'var(--c-muted)', cursor: 'pointer' },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--c-border)', borderRadius: 8, padding: '8px 12px', background: 'var(--c-surface)' },
  searchIcon: { color: 'var(--c-faint)', display: 'inline-flex' },
  search: { flex: 1, border: 'none', outline: 'none', background: 'none', color: 'var(--c-text)', fontSize: 14 },
  results: { border: '1px solid var(--c-border-2)', borderRadius: 8, marginTop: 6, overflow: 'hidden', maxHeight: 220, overflowY: 'auto' },
  result: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '8px 10px', cursor: 'pointer' },
  addIcon: { color: 'var(--c-muted)', display: 'inline-flex' },
  empty: { padding: 12, textAlign: 'center', color: 'var(--c-muted)', fontSize: 13.5 },
  sectionLabel: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--c-muted)', margin: '16px 0 8px' },
  memberList: { display: 'flex', flexDirection: 'column', gap: 2 },
  memberRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 6px', borderRadius: 8 },
  avatar: { width: 30, height: 30, borderRadius: '50%', background: '#f59e0b', color: '#fff', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 },
  userMeta: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
  userName: { fontSize: 14, fontWeight: 600, color: 'var(--c-text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userEmail: { fontSize: 12.5, color: 'var(--c-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  ownerBadge: { fontSize: 11.5, fontWeight: 700, color: 'var(--c-muted)', background: 'var(--c-surface-3)', borderRadius: 999, padding: '2px 10px' },
  removeBtn: { color: 'var(--c-faint)', cursor: 'pointer' },
};
