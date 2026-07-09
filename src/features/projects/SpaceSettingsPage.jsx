import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useHeaderSlot } from '../../layouts/headerSlot';
import { projectsApi, PROJECT_ROLES } from './projectsApi';
import AddMembersModal from './AddMembersModal';
import ManageRolesModal from './ManageRolesModal';
import IconPicker from '../../components/IconPicker';
import AppIcon, { hasIcon } from '../../components/AppIcon';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { useAuth } from '../auth/useAuth';
import { IconArrowLeft } from '../../components/icons';

const NO_PERM_MSG = 'You do not have permission to perform this action.';

const NAV = [
  { id: 'details', label: 'Details' },
  { id: 'access', label: 'Access' },
];

/**
 * Jira-style Space settings page: a left sub-nav (Details / Access) plus the
 * matching panel. Details edits the space (icon, name, key, owner, description);
 * Access manages members and their roles.
 */
export default function SpaceSettingsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const slotEl = useHeaderSlot();
  const toast = useToast();
  const confirm = useConfirm();
  const { user, can } = useAuth();
  const me = user?._id || user?.id;

  const [section, setSection] = useState('details');
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [form, setForm] = useState({ name: '', key: '', description: '' });
  const [saving, setSaving] = useState(false);
  // Space owner can manage even without the role permission (matches backend).
  const canManage = can('project.update') || (!!project?.owner_id && String(project.owner_id) === String(me));

  const load = useCallback(async () => {
    const [p, ms] = await Promise.all([
      projectsApi.get(id).catch(() => null),
      projectsApi.members(id).catch(() => []),
    ]);
    if (p) { setProject(p); setForm({ name: p.name || '', key: p.key || '', description: p.description || '' }); }
    setMembers(ms || []);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const ownerName = useMemo(() => {
    if (!project) return '—';
    const o = members.find((m) => m.user_id === project.owner_id);
    return o?.full_name || project.owner_name || '—';
  }, [project, members]);

  const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);

  const saveIcon = async (icon) => {
    setIconOpen(false);
    if (!canManage) return toast.error(NO_PERM_MSG);
    try { const p = await projectsApi.update(id, { icon }); setProject(p); toast.success('Icon updated'); }
    catch { toast.error('Could not update icon'); }
  };

  const saveDetails = async (e) => {
    e.preventDefault();
    if (!canManage) { toast.error(NO_PERM_MSG); return; }
    setSaving(true);
    try {
      const p = await projectsApi.update(id, { name: form.name.trim(), key: form.key.trim(), description: form.description });
      setProject(p);
      toast.success('Space details saved');
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const changeRole = async (m, role) => {
    if (!canManage) return toast.error(NO_PERM_MSG);
    setMembers((cur) => cur.map((x) => (x.user_id === m.user_id ? { ...x, project_role: role } : x)));
    try { await projectsApi.updateMember(id, m.user_id, { project_role: role }); }
    catch { toast.error('Could not update role'); load(); }
  };

  const removeMember = async (m) => {
    if (!canManage) return toast.error(NO_PERM_MSG);
    if (!(await confirm({ title: 'Remove member', message: `Remove ${m.full_name} from this space?`, confirmLabel: 'Remove', danger: true }))) return;
    try { await projectsApi.removeMember(id, m.user_id); setMembers((cur) => cur.filter((x) => x.user_id !== m.user_id)); toast.success('Member removed'); }
    catch { toast.error('Could not remove member'); }
  };

  if (!project) return <div style={{ padding: 20, color: 'var(--c-muted)' }}>Loading…</div>;

  return (
    <div style={s.wrap}>
      {slotEl && createPortal(
        <span style={s.crumbs}>
          <button style={s.crumbLink} onClick={() => navigate('/projects')}>Spaces</button>
          <span style={s.crumbSep}>›</span>
          <button style={s.crumbLink} onClick={() => navigate(`/projects/${id}`)}>{project.name}</button>
          <span style={s.crumbSep}>›</span>
          <span style={s.crumbCurrent}>Space settings</span>
        </span>, slotEl)}

      {/* Left sub-nav */}
      <aside style={s.nav}>
        <button style={s.back} onClick={() => navigate(`/projects/${id}`)}>
          <IconArrowLeft size={16} /> <span style={{ fontWeight: 700 }}>Space settings</span>
        </button>
        <div style={s.navSpace}>
          <span style={s.navIcon}>{hasIcon(project.icon) ? <AppIcon name={project.icon} size={20} /> : (project.key || project.name || '?')[0]?.toUpperCase()}</span>
          <div style={{ minWidth: 0 }}>
            <div style={s.navSpaceName} title={project.name}>{project.name}</div>
            <div style={s.navSpaceSub}>Space</div>
          </div>
        </div>
        {NAV.map((n) => (
          <button key={n.id} style={{ ...s.navItem, ...(section === n.id ? s.navItemActive : {}) }}
            onClick={() => setSection(n.id)}>{n.label}</button>
        ))}
      </aside>

      {/* Content */}
      <main style={s.content}>
        {section === 'details' && (
          <div style={s.panel}>
            <h2 style={s.h2}>Details</h2>

            <div style={s.iconBlock}>
              <div style={s.iconTile}>
                {hasIcon(project.icon)
                  ? <AppIcon name={project.icon} size={48} />
                  : <span style={s.iconLetter}>{(project.key || project.name || '?')[0]?.toUpperCase()}</span>}
              </div>
              <button style={{ ...s.ghost, ...(canManage ? {} : { opacity: 0.5, cursor: 'not-allowed' }) }}
                title={canManage ? '' : NO_PERM_MSG}
                onClick={() => (canManage ? setIconOpen(true) : toast.error(NO_PERM_MSG))}>Change icon</button>
            </div>

            <form onSubmit={saveDetails} style={{ maxWidth: 520 }}>
              <label style={s.label}>Name <span style={s.req}>*</span></label>
              <input style={s.input} value={form.name} required
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />

              <label style={s.label}>Space key <span style={s.req}>*</span></label>
              <input style={s.input} value={form.key} required
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value.toUpperCase() }))} />

              <label style={s.label}>Space owner</label>
              <div style={{ ...s.input, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--c-surface-2)' }}>
                <span style={s.ownerAvatar}>{ownerName[0]?.toUpperCase() || '?'}</span>{ownerName}
              </div>

              <label style={s.label}>Description</label>
              <textarea style={{ ...s.input, minHeight: 90, resize: 'vertical' }} value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What is this space about?" />

              {!canManage && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 12 }}>{NO_PERM_MSG}</p>}
              <div style={{ marginTop: 16 }}>
                <button type="submit" style={{ ...s.primary, ...(canManage ? {} : { opacity: 0.5, cursor: 'not-allowed' }) }}
                  title={canManage ? '' : NO_PERM_MSG} disabled={saving || !canManage}>{saving ? 'Saving…' : 'Save changes'}</button>
              </div>
            </form>
          </div>
        )}

        {section === 'access' && (
          <div style={s.panel}>
            <div style={s.accessHead}>
              <h2 style={s.h2}>Access</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ ...s.ghost, ...(canManage ? {} : { opacity: 0.5, cursor: 'not-allowed' }) }}
                  title={canManage ? '' : NO_PERM_MSG}
                  onClick={() => (canManage ? setRolesOpen(true) : toast.error(NO_PERM_MSG))}>Manage roles</button>
                <button style={{ ...s.primary, ...(canManage ? {} : { opacity: 0.5, cursor: 'not-allowed' }) }}
                  title={canManage ? '' : NO_PERM_MSG}
                  onClick={() => (canManage ? setAddOpen(true) : toast.error(NO_PERM_MSG))}>Add people</button>
              </div>
            </div>
            <p style={s.accessSub}>People who can access this space and their roles.</p>

            <div style={s.card}>
              <table style={s.table}>
                <thead>
                  <tr><th style={s.th}>Name</th><th style={s.th}>Email</th><th style={s.th}>Role</th><th style={{ ...s.th, textAlign: 'right' }}>Action</th></tr>
                </thead>
                <tbody>
                  {members.length === 0 && <tr><td colSpan={4} style={s.empty}>No members yet.</td></tr>}
                  {members.map((m) => (
                    <tr key={m.user_id} style={s.tr}>
                      <td style={s.td}>
                        <span style={s.rowAvatar}>{(m.full_name || '?')[0]?.toUpperCase()}</span>{m.full_name}
                        {m.user_id === project.owner_id && <span style={s.ownerTag}>Owner</span>}
                      </td>
                      <td style={{ ...s.td, color: 'var(--c-muted)' }}>{m.email || '—'}</td>
                      <td style={s.td}>
                        <select style={s.roleSelect} value={m.project_role || 'employee'} onChange={(e) => changeRole(m, e.target.value)}>
                          {PROJECT_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </td>
                      <td style={{ ...s.td, textAlign: 'right' }}>
                        <button className="wg-danger-link" style={s.removeBtn} onClick={() => removeMember(m)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <AddMembersModal open={addOpen} project={project} projectId={id} existingMemberIds={memberIds}
        onClose={() => setAddOpen(false)} onAdded={() => { setAddOpen(false); load(); }} />
      <IconPicker open={iconOpen} current={project.icon || ''} onSelect={saveIcon} onClose={() => setIconOpen(false)} />
      <ManageRolesModal open={rolesOpen} projectId={id} onClose={() => setRolesOpen(false)} />
    </div>
  );
}

const s = {
  wrap: { display: 'flex', gap: 24, alignItems: 'flex-start' },
  crumbs: { display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 },
  crumbLink: { background: 'none', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 15, fontWeight: 600, padding: 0 },
  crumbSep: { color: 'var(--c-faint)', fontSize: 15 },
  crumbCurrent: { color: 'var(--c-text-strong)', fontSize: 15, fontWeight: 700 },

  nav: { width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  back: { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--c-text-strong)', fontSize: 15, padding: '4px 8px', marginBottom: 6 },
  navSpace: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px', marginBottom: 8 },
  navIcon: { width: 34, height: 34, borderRadius: 8, background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--c-text-strong)', flexShrink: 0 },
  navSpaceName: { fontSize: 14, fontWeight: 600, color: 'var(--c-text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  navSpaceSub: { fontSize: 12, color: 'var(--c-muted)' },
  navItem: { textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '9px 12px', borderRadius: 8,
    fontSize: 14, color: 'var(--c-muted)', position: 'relative' },
  navItemActive: { background: 'var(--c-hover)', color: 'var(--c-text-strong)', fontWeight: 600 },

  content: { flex: 1, minWidth: 0 },
  panel: { maxWidth: 760 },
  h2: { margin: '0 0 16px', fontSize: 24, color: 'var(--c-text-strong)' },

  iconBlock: { display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start', marginBottom: 22 },
  iconTile: { width: 110, height: 110, borderRadius: 14, background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  iconLetter: { fontSize: 44, fontWeight: 800, color: 'var(--c-text-strong)' },

  label: { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--c-text-strong)', margin: '14px 0 6px' },
  req: { color: '#dc2626' },
  input: { width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--c-border)', borderRadius: 8,
    background: 'var(--c-surface)', color: 'var(--c-text-strong)', outline: 'none', fontSize: 14 },
  ownerAvatar: { width: 24, height: 24, borderRadius: '50%', background: '#f59e0b', color: '#fff', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 },

  primary: { padding: '9px 16px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  ghost: { padding: '8px 14px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, cursor: 'pointer', color: 'var(--c-text-strong)', fontWeight: 500 },

  accessHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  accessSub: { fontSize: 13.5, color: 'var(--c-muted)', margin: '2px 0 16px' },
  card: { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '11px 14px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.03em',
    color: 'var(--c-muted)', background: 'var(--c-surface-2)' },
  tr: { borderTop: '1px solid var(--c-border-2)' },
  td: { padding: '11px 14px', fontSize: 14, color: 'var(--c-text)', verticalAlign: 'middle' },
  empty: { padding: 24, textAlign: 'center', color: 'var(--c-muted)' },
  rowAvatar: { width: 26, height: 26, borderRadius: '50%', background: '#f59e0b', color: '#fff', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, marginRight: 9, verticalAlign: 'middle' },
  ownerTag: { marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'var(--c-muted)', background: 'var(--c-surface-2)',
    border: '1px solid var(--c-border)', borderRadius: 5, padding: '1px 6px' },
  roleSelect: { padding: '6px 10px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)', color: 'var(--c-text-strong)' },
  removeBtn: { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14, fontWeight: 500, padding: '4px 8px', borderRadius: 6 },
};
