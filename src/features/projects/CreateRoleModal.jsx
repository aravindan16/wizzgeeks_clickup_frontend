import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { projectsApi } from './projectsApi';
import { PERMISSION_GROUPS } from './spaceRoleCatalog';
import { useToast } from '../../components/Toast';
import { IconClose } from '../../components/icons';

/**
 * "Create custom role" modal (Jira-style): a name, a scrollable tree of grouped
 * permissions with parent (select-all) + child checkboxes, and Create/Discard.
 * When `seed` is given (Duplicate role), the form pre-fills with that role's name
 * (+ " Copy"), description, and permissions.
 */
export default function CreateRoleModal({ open, projectId, seed, onClose, onCreated }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  // (Re)seed the form each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setName(seed ? `${seed.name} Copy` : '');
    setDesc(seed?.description || '');
    setSelected(new Set(seed?.permissions || []));
  }, [open, seed]);

  const groupState = useMemo(() => PERMISSION_GROUPS.map((g) => {
    const keys = g.perms.map((p) => p.key);
    const on = keys.filter((k) => selected.has(k)).length;
    return { g, all: on === keys.length && keys.length > 0, some: on > 0 && on < keys.length };
  }), [selected]);

  if (!open) return null;

  const toggle = (key) => setSelected((cur) => {
    const n = new Set(cur);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });
  const toggleGroup = (g, allOn) => setSelected((cur) => {
    const n = new Set(cur);
    g.perms.forEach((p) => (allOn ? n.delete(p.key) : n.add(p.key)));
    return n;
  });

  const create = async () => {
    if (!name.trim()) { toast.error('Give the role a name'); return; }
    setBusy(true);
    try {
      await projectsApi.createRole(projectId, { name: name.trim(), description: desc.trim() || null, permissions: [...selected] });
      toast.success('Role created');
      setName(''); setDesc(''); setSelected(new Set());
      onCreated?.();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Could not create role'); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div style={s.backdrop} onMouseDown={onClose}>
      <div style={s.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <strong style={s.title}>{seed ? 'Duplicate role' : 'Create custom role'}</strong>
          <button className="icon-btn" style={s.x} title="Close" onClick={onClose}><IconClose size={18} /></button>
        </div>

        <div style={s.body}>
          <label style={s.label}>Role name</label>
          <input style={s.input} autoFocus value={name} placeholder="e.g. Reviewer" onChange={(e) => setName(e.target.value)} />
          <label style={s.label}>Description</label>
          <input style={s.input} value={desc} placeholder="What can this role do?" onChange={(e) => setDesc(e.target.value)} />

          <div style={s.permsLabel}>Permissions</div>
          <div style={s.perms}>
            {groupState.map(({ g, all, some }) => (
              <div key={g.key} style={s.group}>
                <label style={s.groupRow}>
                  <input type="checkbox" checked={all} ref={(el) => { if (el) el.indeterminate = some; }}
                    onChange={() => toggleGroup(g, all)} />
                  <span>
                    <span style={s.groupName}>{g.label}</span>
                    <span style={s.groupDesc}>{g.description}</span>
                  </span>
                </label>
                <div style={s.children}>
                  {g.perms.map((p) => (
                    <label key={p.key} style={s.permRow}>
                      <input type="checkbox" checked={selected.has(p.key)} onChange={() => toggle(p.key)} />
                      <span>
                        <span style={s.permName}>{p.label}</span>
                        <span style={s.permDesc}>{p.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={s.footer}>
          <span style={s.count}>{selected.size} permission{selected.size === 1 ? '' : 's'} selected</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={s.ghost} onClick={onClose}>Discard</button>
            <button style={s.primary} onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(16,24,40,.5)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: 640, maxWidth: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,.3)', overflow: 'hidden' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--c-border)' },
  title: { fontSize: 18, color: 'var(--c-text-strong)' },
  x: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: 'none', color: 'var(--c-muted)', borderRadius: 8, cursor: 'pointer' },
  body: { padding: '16px 18px', overflowY: 'auto' },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--c-text-strong)', margin: '10px 0 6px' },
  input: { width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--c-border)', borderRadius: 8,
    background: 'var(--c-surface)', color: 'var(--c-text-strong)', outline: 'none', fontSize: 14 },
  permsLabel: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--c-muted)', margin: '18px 0 8px' },
  perms: { display: 'flex', flexDirection: 'column', gap: 6 },
  group: { border: '1px solid var(--c-border)', borderRadius: 10, padding: '10px 12px' },
  groupRow: { display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' },
  groupName: { display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--c-text-strong)' },
  groupDesc: { display: 'block', fontSize: 12.5, color: 'var(--c-muted)', marginTop: 1 },
  children: { display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 26, marginTop: 8 },
  permRow: { display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' },
  permName: { display: 'block', fontSize: 13.5, color: 'var(--c-text)' },
  permDesc: { display: 'block', fontSize: 12, color: 'var(--c-muted)', marginTop: 1 },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '14px 18px', borderTop: '1px solid var(--c-border)' },
  count: { fontSize: 12.5, color: 'var(--c-muted)' },
  ghost: { padding: '9px 16px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text-strong)', borderRadius: 8, cursor: 'pointer' },
  primary: { padding: '9px 18px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
};
