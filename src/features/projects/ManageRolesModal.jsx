import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { projectsApi } from './projectsApi';
import { SYSTEM_ROLES } from './spaceRoleCatalog';
import CreateRoleModal from './CreateRoleModal';
import { Copy as IconCopy } from 'lucide-react';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { IconClose, IconTrash } from '../../components/icons';

/**
 * "Manage roles" modal (Jira-style): lists the built-in system roles plus any
 * custom roles created for this space, with a "Create role" action.
 */
export default function ManageRolesModal({ open, projectId, onClose }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [custom, setCustom] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [seed, setSeed] = useState(null); // role to duplicate (null = create fresh)

  const duplicate = (r) => { setSeed({ name: r.name, description: r.description, permissions: r.permissions || [] }); setCreateOpen(true); };
  const createFresh = () => { setSeed(null); setCreateOpen(true); };

  const load = useCallback(() => {
    if (!projectId) return;
    projectsApi.roles(projectId).then(setCustom).catch(() => setCustom([]));
  }, [projectId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  if (!open) return null;

  const removeRole = async (r) => {
    if (!(await confirm({ title: 'Delete role', message: `Delete the "${r.name}" role?`, confirmLabel: 'Delete', danger: true }))) return;
    try { await projectsApi.removeRole(projectId, r._id); setCustom((cur) => cur.filter((x) => x._id !== r._id)); toast.success('Role deleted'); }
    catch { toast.error('Could not delete role'); }
  };

  return createPortal(
    <div style={s.backdrop} onMouseDown={onClose}>
      <div style={s.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <strong style={s.title}>Manage roles</strong>
          <button className="icon-btn" style={s.x} title="Close" onClick={onClose}><IconClose size={18} /></button>
        </div>

        <div style={s.body}>
          {SYSTEM_ROLES.map((r) => (
            <div key={r.key} style={s.roleRow}>
              <div style={{ minWidth: 0 }}>
                <div style={s.roleTop}>
                  <span style={s.roleName}>{r.name}</span>
                  <span style={s.sysTag}>SYSTEM ROLE</span>
                </div>
                <div style={s.roleDesc}>{r.description}</div>
              </div>
              <button className="icon-btn" style={s.copy} title="Duplicate role" onClick={() => duplicate(r)}><IconCopy size={16} /></button>
            </div>
          ))}

          {custom.length > 0 && <div style={s.sectionLabel}>Custom roles</div>}
          {custom.map((r) => (
            <div key={r._id} style={s.roleRow}>
              <div style={{ minWidth: 0 }}>
                <div style={s.roleTop}>
                  <span style={s.roleName}>{r.name}</span>
                  <span style={s.customTag}>{(r.permissions || []).length} permissions</span>
                </div>
                {r.description && <div style={s.roleDesc}>{r.description}</div>}
              </div>
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                <button className="icon-btn" style={s.copy} title="Duplicate role" onClick={() => duplicate(r)}><IconCopy size={16} /></button>
                <button className="icon-btn" style={s.del} title="Delete role" onClick={() => removeRole(r)}><IconTrash size={16} /></button>
              </div>
            </div>
          ))}
        </div>

        <div style={s.footer}>
          <button style={s.primary} onClick={createFresh}>Create role</button>
          <button style={s.ghost} onClick={onClose}>Close</button>
        </div>
      </div>

      <CreateRoleModal open={createOpen} projectId={projectId} seed={seed}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); load(); }} />
    </div>,
    document.body,
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(16,24,40,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: 680, maxWidth: '100%', maxHeight: '84vh', display: 'flex', flexDirection: 'column', background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,.3)', overflow: 'hidden' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--c-border)' },
  title: { fontSize: 20, color: 'var(--c-text-strong)' },
  x: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: 'none', color: 'var(--c-muted)', borderRadius: 8, cursor: 'pointer' },
  body: { padding: '10px 20px', overflowY: 'auto' },
  sectionLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--c-faint)', margin: '14px 0 6px' },
  roleRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '16px 0', borderBottom: '1px solid var(--c-border-2)' },
  roleTop: { display: 'flex', alignItems: 'center', gap: 10 },
  roleName: { fontSize: 15, fontWeight: 600, color: 'var(--c-text-strong)' },
  sysTag: { fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', color: 'var(--c-muted)', background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: 5, padding: '2px 7px' },
  customTag: { fontSize: 11, fontWeight: 600, color: 'var(--c-primary)', background: 'var(--c-primary-weak)', borderRadius: 5, padding: '2px 7px' },
  roleDesc: { fontSize: 13.5, color: 'var(--c-muted)', marginTop: 4, lineHeight: 1.45 },
  copy: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: 'none', color: 'var(--c-muted)', borderRadius: 8, cursor: 'pointer', flexShrink: 0 },
  del: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: 'none', color: 'var(--c-danger, #dc2626)', borderRadius: 8, cursor: 'pointer', flexShrink: 0 },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--c-border)' },
  primary: { padding: '9px 16px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  ghost: { padding: '9px 16px', background: 'none', border: 'none', color: 'var(--c-text-strong)', cursor: 'pointer', fontWeight: 500 },
};
