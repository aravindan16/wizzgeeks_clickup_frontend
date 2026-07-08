import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHeaderSlot } from '../../layouts/headerSlot';
import { rolesApi } from './rolesApi';
import ManageGlobalRolesModal from './ManageGlobalRolesModal';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { IconTrash } from '../../components/icons';

/**
 * Global Roles & Permissions admin. The permission catalog and roles are loaded
 * from the DB (never hardcoded). Admins can edit a role's permissions, create
 * custom roles, and delete custom roles.
 */
export default function PermissionsPage() {
  const slotEl = useHeaderSlot();
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [catalog, setCatalog] = useState([]); // [{ key, module, permissions:[{key,label}] }]
  const [roles, setRoles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState(() => new Set()); // edited permission set
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);

  const canEdit = can('role.update');

  const load = useCallback(async () => {
    setLoading(true);
    const [cat, rs] = await Promise.all([
      rolesApi.catalog().then((d) => d.groups || []).catch(() => []),
      rolesApi.manageList().catch(() => []),
    ]);
    setCatalog(cat); setRoles(rs);
    setActiveId((cur) => cur || rs[0]?.id || null);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const role = useMemo(() => roles.find((r) => r.id === activeId) || roles[0], [roles, activeId]);
  const isWildcard = (role?.permissions || []).includes('*');

  // Sync the editable draft when the selected role changes.
  useEffect(() => {
    setDraft(new Set(role?.permissions || []));
    setDirty(false);
  }, [role?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key) => {
    if (!canEdit || isWildcard || role?.key === 'super_admin') return;
    setDraft((cur) => { const n = new Set(cur); n.has(key) ? n.delete(key) : n.add(key); return n; });
    setDirty(true);
  };
  const toggleModule = (perms, allOn) => {
    if (!canEdit || isWildcard) return;
    setDraft((cur) => { const n = new Set(cur); perms.forEach((p) => (allOn ? n.delete(p.key) : n.add(p.key))); return n; });
    setDirty(true);
  };

  const save = async () => {
    try {
      const updated = await rolesApi.update(role.id, { permissions: [...draft] });
      setRoles((cur) => cur.map((r) => (r.id === role.id ? updated : r)));
      setDirty(false);
      toast.success('Permissions updated');
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Could not save'); }
  };

  const removeRole = async (r) => {
    if (!(await confirm({ title: 'Delete role', message: `Delete the "${r.name}" role?`, confirmLabel: 'Delete', danger: true }))) return;
    try { await rolesApi.remove(r.id); setRoles((cur) => cur.filter((x) => x.id !== r.id)); setActiveId(null); toast.success('Role deleted'); }
    catch (err) { toast.error(err.response?.data?.error?.message || 'Could not delete role'); }
  };

  return (
    <div style={s.page}>
      {slotEl && createPortal(<span style={s.headerTitle}>Permissions</span>, slotEl)}

      <div style={s.head}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>Roles &amp; Permissions</h2>
          <p style={s.sub}>Each role grants a set of permissions across the app. Permissions are stored in the database.
            Access to this page is controlled by <strong>“Access the Permission setting page”</strong> — Super Admin and Admin have it by default; grant it to another role to let them manage permissions.</p>
        </div>
        {can('permission.manage') && <button style={s.primaryBtn} onClick={() => setManageOpen(true)}>Manage roles</button>}
      </div>

      {loading ? <p style={{ color: 'var(--c-muted)' }}>Loading…</p> : (
        <div style={s.layout}>
          <div style={s.roleList}>
            {roles.map((r) => (
              <button key={r.id} style={{ ...s.roleBtn, ...(r.id === role?.id ? s.roleBtnActive : {}) }} onClick={() => setActiveId(r.id)}>
                <span style={{ minWidth: 0 }}>
                  <span style={s.roleName}>{r.name}</span>
                  {r.is_system && <span style={s.sysTag}>SYSTEM</span>}
                </span>
                <span style={s.roleMeta}>{(r.permissions || []).includes('*') ? 'All' : (r.permissions || []).length}</span>
              </button>
            ))}
          </div>

          <div style={s.detail}>
            {!role ? <p style={{ color: 'var(--c-muted)' }}>No role selected.</p> : (
              <>
                <div style={s.detailHead}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 style={{ margin: 0 }}>{role.name}</h3>
                    <span style={s.levelTag}>level {role.level}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {canEdit && !isWildcard && dirty && <button style={s.primary} onClick={save}>Save changes</button>}
                    {can('role.delete') && !role.is_system && (
                      <button className="icon-btn" style={s.del} title="Delete role" onClick={() => removeRole(role)}><IconTrash size={16} /></button>
                    )}
                  </div>
                </div>

                {isWildcard ? (
                  <div style={s.allBanner}>★ This role has <strong>all permissions</strong> (super administrator) and can’t be edited.</div>
                ) : (
                  <div style={s.groups}>
                    {catalog.map((g) => {
                      const on = g.permissions.filter((p) => draft.has(p.key)).length;
                      const all = on === g.permissions.length;
                      const some = on > 0 && !all;
                      return (
                        <div key={g.key} style={s.group}>
                          <label style={s.groupRow}>
                            <input type="checkbox" checked={all} disabled={!canEdit}
                              ref={(el) => { if (el) el.indeterminate = some; }}
                              onChange={() => toggleModule(g.permissions, all)} />
                            <span style={s.groupName}>{g.module}</span>
                            <span style={s.groupCount}>{on}/{g.permissions.length}</span>
                          </label>
                          <div style={s.perms}>
                            {g.permissions.map((p) => (
                              <label key={p.key} style={s.permRow}>
                                <input type="checkbox" checked={draft.has(p.key)} disabled={!canEdit}
                                  onChange={() => toggle(p.key)} />
                                <span style={s.permLabel}>{p.label}</span>
                                <code style={s.permKey}>{p.key}</code>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <ManageGlobalRolesModal open={manageOpen} roles={roles} catalog={catalog}
        onClose={() => setManageOpen(false)}
        onChanged={() => { setManageOpen(false); load(); }} />
    </div>
  );
}

const s = {
  page: { height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 },
  headerTitle: { fontSize: 16, fontWeight: 700, color: 'var(--c-text-strong)' },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexShrink: 0 },
  sub: { fontSize: 13.5, color: 'var(--c-muted)', margin: '4px 0 18px', maxWidth: 900 },
  primary: { padding: '9px 16px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  primaryBtn: { padding: '9px 18px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8,
    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, alignSelf: 'flex-start' },
  layout: { display: 'flex', gap: 20, flex: 1, minHeight: 0 },
  roleList: { width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4,
    alignSelf: 'flex-start', maxHeight: '100%', overflowY: 'auto' },
  roleBtn: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '11px 14px',
    background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, cursor: 'pointer', textAlign: 'left' },
  roleBtnActive: { borderColor: 'var(--c-primary)', background: 'var(--c-primary-weak)' },
  roleName: { fontSize: 14, fontWeight: 600, color: 'var(--c-text-strong)' },
  sysTag: { marginLeft: 6, fontSize: 9.5, fontWeight: 700, color: 'var(--c-muted)', background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: 4, padding: '1px 5px' },
  roleMeta: { fontSize: 12, color: 'var(--c-muted)', background: 'var(--c-surface-2)', borderRadius: 6, padding: '1px 8px', flexShrink: 0 },
  detail: { flex: 1, minWidth: 0, minHeight: 0, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 20,
    height: '100%', overflowY: 'auto', boxSizing: 'border-box' },
  detailHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16,
    position: 'sticky', top: -20, background: 'var(--c-surface)', paddingTop: 4, marginTop: -4, zIndex: 1 },
  levelTag: { fontSize: 11.5, fontWeight: 700, color: 'var(--c-muted)', background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: 5, padding: '2px 8px' },
  del: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: 'none', color: 'var(--c-danger, #dc2626)', borderRadius: 8, cursor: 'pointer' },
  allBanner: { padding: '14px 16px', background: 'var(--c-primary-weak)', color: 'var(--c-text-strong)', borderRadius: 10, fontSize: 14 },
  groups: { display: 'flex', flexDirection: 'column', gap: 14 },
  group: { border: '1px solid var(--c-border)', borderRadius: 10, padding: '10px 12px' },
  groupRow: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  groupName: { fontSize: 14, fontWeight: 700, color: 'var(--c-text-strong)' },
  groupCount: { marginLeft: 'auto', fontSize: 12, color: 'var(--c-muted)' },
  perms: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, paddingLeft: 26, marginTop: 8 },
  permRow: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 0 },
  permLabel: { fontSize: 13, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  permKey: { fontSize: 11, color: 'var(--c-faint)', background: 'var(--c-surface-2)', borderRadius: 4, padding: '0 5px', flexShrink: 0 },
};
