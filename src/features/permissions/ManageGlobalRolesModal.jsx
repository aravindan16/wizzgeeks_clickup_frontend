import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy as IconCopy } from 'lucide-react';
import { rolesApi } from './rolesApi';
import RoleFormModal from './RoleFormModal';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { useAuth } from '../auth/useAuth';
import { IconClose, IconTrash } from '../../components/icons';

const roleSummary = (r) => {
  if ((r.permissions || []).includes('*')) return 'Full control over everything.';
  if (r.key === 'admin') return 'Can do most things, like update settings, manage members, and manage tasks.';
  if (r.key === 'employee') return 'Part of the team — can create, edit, and collaborate on work.';
  return `${(r.permissions || []).length} permissions.`;
};

/**
 * Global "Manage roles" modal: lists the roles (Super Admin / Admin / Employee +
 * custom) with a duplicate (copy) action, delete for custom roles, and Create role.
 * Permission selection lives in RoleFormModal (DB catalog).
 */
export default function ManageGlobalRolesModal({ open, roles, catalog, onClose, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { can } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [seed, setSeed] = useState(null);

  if (!open) return null;

  const duplicate = (r) => { setSeed({ name: r.name, permissions: r.permissions || [] }); setFormOpen(true); };
  const createFresh = () => { setSeed(null); setFormOpen(true); };

  const removeRole = async (r) => {
    if (!(await confirm({ title: 'Delete role', message: `Delete the "${r.name}" role?`, confirmLabel: 'Delete', danger: true }))) return;
    try { await rolesApi.remove(r.id); toast.success('Role deleted'); onChanged?.(); }
    catch (err) { toast.error(err.response?.data?.error?.message || 'Could not delete role'); }
  };

  return createPortal(
    <div style={s.backdrop} onMouseDown={onClose}>
      <div style={s.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <strong style={s.title}>Manage roles</strong>
          <button className="icon-btn wg-x-btn" style={s.x} title="Close" onClick={onClose}><IconClose size={18} /></button>
        </div>

        <div style={s.body}>
          {roles.map((r) => (
            <div key={r.id} style={s.roleRow}>
              <div style={{ minWidth: 0 }}>
                <div style={s.roleTop}>
                  <span style={s.roleName}>{r.name}</span>
                  {r.is_system && <span style={s.sysTag}>SYSTEM ROLE</span>}
                </div>
                <div style={s.roleDesc}>{roleSummary(r)}</div>
              </div>
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                {can('role.create') && (
                  <button className="icon-btn" style={s.copy} title="Duplicate role" onClick={() => duplicate(r)}><IconCopy size={16} /></button>
                )}
                {can('role.delete') && !r.is_system && (
                  <button className="icon-btn" style={s.del} title="Delete role" onClick={() => removeRole(r)}><IconTrash size={16} /></button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={s.footer}>
          {can('role.create') && <button style={s.primary} onClick={createFresh}>Create role</button>}
          <button className="wg-close-btn" style={s.ghost} onClick={onClose}>Close</button>
        </div>
      </div>

      <RoleFormModal open={formOpen} catalog={catalog} seed={seed}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); onChanged?.(); }} />
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
  x: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: 'none', background: 'none', borderRadius: 8, cursor: 'pointer' },
  body: { padding: '10px 20px', overflowY: 'auto' },
  roleRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '16px 0', borderBottom: '1px solid var(--c-border-2)' },
  roleTop: { display: 'flex', alignItems: 'center', gap: 10 },
  roleName: { fontSize: 15, fontWeight: 600, color: 'var(--c-text-strong)' },
  sysTag: { fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', color: 'var(--c-muted)', background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: 5, padding: '2px 7px' },
  roleDesc: { fontSize: 13.5, color: 'var(--c-muted)', marginTop: 4, lineHeight: 1.45 },
  copy: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: 'none', color: 'var(--c-muted)', borderRadius: 8, cursor: 'pointer' },
  del: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: 'none', color: 'var(--c-danger, #dc2626)', borderRadius: 8, cursor: 'pointer' },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--c-border)' },
  primary: { padding: '9px 16px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  ghost: { padding: '9px 16px', background: 'none', border: 'none', borderRadius: 8, color: 'var(--c-text-strong)', cursor: 'pointer', fontWeight: 500 },
};
