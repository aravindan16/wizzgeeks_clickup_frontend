import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { rolesApi } from './rolesApi';
import { useToast } from '../../components/Toast';
import { IconClose } from '../../components/icons';

/**
 * Create / Duplicate a global role. Permissions are chosen from the DB catalog
 * (grouped, parent + child checkboxes). When `seed` is given (Duplicate), the
 * form pre-fills with that role's name (+ " Copy") and its permissions; a
 * wildcard (*) seed expands to every catalog permission.
 */
export default function RoleFormModal({ open, catalog, seed, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  const allKeys = useMemo(() => catalog.flatMap((g) => g.permissions.map((p) => p.key)), [catalog]);

  useEffect(() => {
    if (!open) return;
    setName(seed ? `${seed.name} Copy` : '');
    const perms = seed?.permissions || [];
    setSelected(new Set(perms.includes('*') ? allKeys : perms));
  }, [open, seed, allKeys]);

  if (!open) return null;

  const toggle = (key) => setSelected((cur) => { const n = new Set(cur); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleGroup = (perms, allOn) => setSelected((cur) => {
    const n = new Set(cur); perms.forEach((p) => (allOn ? n.delete(p.key) : n.add(p.key))); return n;
  });

  const create = async () => {
    if (!name.trim()) { toast.error('Give the role a name'); return; }
    setBusy(true);
    try {
      await rolesApi.create({ name: name.trim(), permissions: [...selected] });
      toast.success('Role created');
      onSaved?.();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Could not create role'); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div style={s.backdrop} onMouseDown={onClose}>
      <div style={s.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <strong style={s.title}>{seed ? 'Duplicate role' : 'Create role'}</strong>
          <button className="icon-btn wg-x-btn" style={s.x} title="Close" onClick={onClose}><IconClose size={18} /></button>
        </div>

        <div style={s.body}>
          <label style={s.label}>Role name</label>
          <input style={s.input} autoFocus value={name} placeholder="e.g. Reviewer" onChange={(e) => setName(e.target.value)} />

          <div style={s.permsLabel}>Permissions</div>
          <div style={s.groups}>
            {catalog.map((g) => {
              const on = g.permissions.filter((p) => selected.has(p.key)).length;
              const all = on === g.permissions.length && g.permissions.length > 0;
              const some = on > 0 && !all;
              return (
                <div key={g.key} style={s.group}>
                  <label style={s.groupRow}>
                    <input type="checkbox" checked={all} ref={(el) => { if (el) el.indeterminate = some; }}
                      onChange={() => toggleGroup(g.permissions, all)} />
                    <span style={s.groupName}>{g.module}</span>
                    <span style={s.groupCount}>{on}/{g.permissions.length}</span>
                  </label>
                  <div style={s.perms}>
                    {g.permissions.map((p) => (
                      <label key={p.key} style={s.permRow}>
                        <input type="checkbox" checked={selected.has(p.key)} onChange={() => toggle(p.key)} />
                        <span style={s.permLabel} title={p.key}>{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={s.footer}>
          <span style={s.count}>{selected.size} permission{selected.size === 1 ? '' : 's'} selected</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="wg-close-btn" style={s.ghost} onClick={onClose}>Discard</button>
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
  x: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: 'none', background: 'none', borderRadius: 8, cursor: 'pointer' },
  body: { padding: '16px 18px', overflowY: 'auto' },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--c-text-strong)', margin: '6px 0 6px' },
  input: { width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--c-border)', borderRadius: 8,
    background: 'var(--c-surface)', color: 'var(--c-text-strong)', outline: 'none', fontSize: 14 },
  permsLabel: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--c-muted)', margin: '18px 0 8px' },
  groups: { display: 'flex', flexDirection: 'column', gap: 10 },
  group: { border: '1px solid var(--c-border)', borderRadius: 10, padding: '10px 12px' },
  groupRow: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  groupName: { fontSize: 14, fontWeight: 700, color: 'var(--c-text-strong)' },
  groupCount: { marginLeft: 'auto', fontSize: 12, color: 'var(--c-muted)' },
  perms: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, paddingLeft: 26, marginTop: 8 },
  permRow: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 0 },
  permLabel: { fontSize: 13, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '14px 18px', borderTop: '1px solid var(--c-border)' },
  count: { fontSize: 12.5, color: 'var(--c-muted)' },
  ghost: { padding: '9px 16px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text-strong)', borderRadius: 8, cursor: 'pointer' },
  primary: { padding: '9px 18px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
};
