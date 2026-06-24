import { useEffect, useState } from 'react';
import { projectsApi, PROJECT_STATUSES } from './projectsApi';
import Select from '../../components/Select';

const EMPTY = { key: '', name: '', description: '', start_date: '', end_date: '' };

export default function ProjectModal({ open, mode, project, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && project) {
      setForm({
        key: project.key,
        name: project.name || '',
        description: project.description || '',
        status: project.status,
        start_date: project.start_date || '',
        end_date: project.end_date || '',
      });
    } else {
      setForm(EMPTY);
    }
    setError(null);
  }, [mode, project, open]);

  if (!open) return null;
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (mode === 'edit') {
        await projectsApi.update(project._id, {
          name: form.name,
          description: form.description,
          status: form.status,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        });
      } else {
        await projectsApi.create({
          key: form.key,
          name: form.name,
          description: form.description || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        });
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={ov.backdrop} onClick={onClose}>
      <div style={ov.modal} onClick={(e) => e.stopPropagation()}>
        <h3>{mode === 'edit' ? 'Edit Space' : 'Create Space'}</h3>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Field label="Key">
              <input style={ov.input} value={form.key} disabled={mode === 'edit'}
                onChange={(e) => setField('key', e.target.value.toUpperCase())}
                placeholder="e.g. WEB" maxLength={10} required />
            </Field>
            <Field label="Name">
              <input style={ov.input} value={form.name}
                onChange={(e) => setField('name', e.target.value)} required />
            </Field>
          </div>

          <Field label="Description">
            <textarea style={{ ...ov.input, minHeight: 70 }} value={form.description}
              onChange={(e) => setField('description', e.target.value)} />
          </Field>

          {mode === 'edit' && (
            <Field label="Status">
              <Select value={form.status} onChange={(v) => setField('status', v)}
                options={PROJECT_STATUSES.map((st) => ({ value: st, label: st }))} />
            </Field>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Field label="Start date">
              <input style={ov.input} type="date" value={form.start_date}
                onChange={(e) => setField('start_date', e.target.value)} />
            </Field>
            <Field label="End date">
              <input style={ov.input} type="date" value={form.end_date}
                onChange={(e) => setField('end_date', e.target.value)} />
            </Field>
          </div>

          {error && <p style={{ color: '#991b1b', fontSize: 13 }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={ov.btnGhost}>Cancel</button>
            <button type="submit" disabled={saving} style={ov.btn}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

const ov = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  modal: { background: '#fff', borderRadius: 12, padding: 24, width: 500, maxWidth: '90vw' },
  input: { padding: '9px 11px', border: '1px solid #d1d5db', borderRadius: 8, width: '100%' },
  btn: { padding: '9px 18px', background: '#111827', color: '#fff', border: 'none',
    borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { padding: '9px 18px', background: '#fff', border: '1px solid #d1d5db',
    borderRadius: 8, cursor: 'pointer' },
};
