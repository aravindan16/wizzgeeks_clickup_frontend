import { useEffect, useState } from 'react';
import { listsApi } from './listsApi';
import { useToast } from '../../components/Toast';
import Select from '../../components/Select';

// Suggest a task-ID prefix (e.g. "Frontend" → "FE", "Weekly Tasks" → "WT").
function suggestKey(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  let key = words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] || '');
  key = key.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10);
  return key.length >= 2 ? key : (key + 'LST').slice(0, 3);
}

/**
 * "Create List" dialog: name + key + target Space (preselected). Calls onCreated(newList)
 * so the sidebar can insert it instantly.
 */
export default function CreateListModal({ open, onClose, onCreated, spaces = [], defaultSpaceId }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [spaceId, setSpaceId] = useState(defaultSpaceId || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setName(''); setKey(''); setKeyEdited(false); setError(null);
      setSpaceId(defaultSpaceId || spaces[0]?._id || '');
    }
  }, [open, defaultSpaceId, spaces]);

  // Auto-suggest the key from the name until the user edits it manually.
  useEffect(() => {
    if (!keyEdited) setKey(suggestKey(name));
  }, [name, keyEdited]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !spaceId || key.trim().length < 2) return;
    setSaving(true); setError(null);
    try {
      const created = await listsApi.create({ space_id: spaceId, name: name.trim(), key: key.trim().toUpperCase() });
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
          <span style={s.lbl}>Key <span style={{ color: '#9ca3af', fontWeight: 400 }}>· task IDs like {(key || 'FE')}-1</span></span>
          <input style={s.input} value={key}
            onChange={(e) => { setKeyEdited(true); setKey(e.target.value.toUpperCase()); }}
            placeholder="FE" maxLength={10} required />
        </label>

        <label style={s.field}>
          <span style={s.lbl}>Space</span>
          <Select value={spaceId} onChange={setSpaceId} placeholder="Select a Space…"
            options={spaces.map((sp) => ({ value: sp._id, label: sp.name }))} />
        </label>

        {error && <p style={{ color: '#b91c1c', fontSize: 13, margin: '4px 0 0' }}>{error}</p>}

        <div style={s.footer}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !name.trim() || !spaceId || key.trim().length < 2}>
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
