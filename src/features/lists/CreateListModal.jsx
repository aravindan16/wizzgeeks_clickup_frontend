import { useEffect, useState } from 'react';
import { listsApi } from './listsApi';
import { useToast } from '../../components/Toast';
import { useAuth } from '../auth/useAuth';
import Select from '../../components/Select';

const NO_PERM_MSG = 'You do not have permission to perform this action.';

/**
 * "Create List" dialog: name + target Space (preselected). Calls onCreated(newList)
 * so the sidebar can insert it instantly. (Task IDs use the Space's key, so a List
 * needs no key of its own.)
 */
export default function CreateListModal({ open, onClose, onCreated, spaces = [], defaultSpaceId }) {
  const toast = useToast();
  const { can } = useAuth();
  const canCreate = can('list.create');
  const [name, setName] = useState('');
  const [spaceId, setSpaceId] = useState(defaultSpaceId || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setName(''); setError(null);
      setSpaceId(defaultSpaceId || spaces[0]?._id || '');
    }
  }, [open, defaultSpaceId, spaces]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!canCreate) { setError(NO_PERM_MSG); return; }
    if (!name.trim() || !spaceId) return;
    setSaving(true); setError(null);
    try {
      const created = await listsApi.create({ space_id: spaceId, name: name.trim() });
      toast.success('List created');
      onCreated?.(created);
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not create list');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s.backdrop} onClick={onClose}>
      <form style={s.modal} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div style={s.head}>
          <strong style={{ fontSize: 17 }}>Create List</strong>
          <button type="button" className="icon-btn" onClick={onClose} title="Close">✕</button>
        </div>

        <label style={s.field}>
          <span style={s.lbl}>List name</span>
          <input autoFocus style={s.input} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Weekly Tasks" required />
        </label>

        <label style={s.field}>
          <span style={s.lbl}>Space</span>
          <Select value={spaceId} onChange={setSpaceId} placeholder="Select a Space…"
            options={spaces.map((sp) => ({ value: sp._id, label: sp.name }))} />
        </label>

        {(error || !canCreate) && <p style={{ color: '#b91c1c', fontSize: 13, margin: '4px 0 0' }}>{error || NO_PERM_MSG}</p>}

        <div style={s.footer}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary"
            title={canCreate ? '' : NO_PERM_MSG}
            disabled={!canCreate || saving || !name.trim() || !spaceId}>
            {saving ? 'Creating…' : 'Create List'}
          </button>
        </div>
      </form>
    </div>
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 80,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: '#fff', borderRadius: 14, padding: 22, width: 460, maxWidth: '95vw',
    boxShadow: '0 24px 60px rgba(0,0,0,.28)', display: 'flex', flexDirection: 'column', gap: 14 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  lbl: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: { padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
};
