import { useEffect, useState } from 'react';
import { usersApi } from './usersApi';
import { IconClose } from '../../components/icons';
import PasswordInput from '../../components/PasswordInput';

/**
 * Create/Edit user modal. In edit mode the password field is hidden (password
 * changes go through the auth reset/change flows). Role assignment is a checkbox
 * list sourced from GET /roles.
 */
const EMPTY = {
  email: '',
  password: '',
  full_name: '',
  designation: '',
  department: '',
  role_keys: ['employee'],
};

export default function UserModal({ open, mode, user, roles, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && user) {
      setForm({
        email: user.email,
        full_name: user.full_name || '',
        designation: user.designation || '',
        department: user.department || '',
        role_keys: user.roles || [],
      });
    } else {
      setForm(EMPTY);
    }
    setError(null);
  }, [mode, user, open]);

  if (!open) return null;

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleRole = (key) =>
    setForm((f) => ({
      ...f,
      role_keys: f.role_keys.includes(key)
        ? f.role_keys.filter((r) => r !== key)
        : [...f.role_keys, key],
    }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.role_keys.length === 0) {
      setError('Select at least one role');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'edit') {
        await usersApi.update(user._id, {
          full_name: form.full_name,
          designation: form.designation,
          department: form.department,
          role_keys: form.role_keys,
        });
      } else {
        await usersApi.create(form);
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
        <div style={ov.head}>
          <h3 style={{ margin: 0 }}>{mode === 'edit' ? 'Edit User' : 'Create User'}</h3>
          <button type="button" className="icon-btn" style={ov.close} onClick={onClose} aria-label="Close"><IconClose size={18} /></button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="Full name">
            <input style={ov.input} value={form.full_name}
              onChange={(e) => setField('full_name', e.target.value)} required />
          </Field>

          <Field label="Email">
            <input style={ov.input} type="email" value={form.email} disabled={mode === 'edit'}
              onChange={(e) => setField('email', e.target.value)} required />
          </Field>

          {mode === 'create' && (
            <Field label="Password">
              <PasswordInput style={ov.input} value={form.password}
                onChange={(e) => setField('password', e.target.value)}
                minLength={8} required placeholder="min 8 characters" />
            </Field>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Field label="Designation">
              <input style={ov.input} value={form.designation}
                onChange={(e) => setField('designation', e.target.value)} />
            </Field>
            <Field label="Department">
              <input style={ov.input} value={form.department}
                onChange={(e) => setField('department', e.target.value)} />
            </Field>
          </div>

          <Field label="Roles">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {roles.map((r) => (
                <label key={r.key} style={ov.role}>
                  <input type="checkbox" checked={form.role_keys.includes(r.key)}
                    onChange={() => toggleRole(r.key)} /> {r.name}
                </label>
              ))}
            </div>
          </Field>

          {error && <p style={{ color: '#991b1b', fontSize: 13 }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={ov.btnGhost}>Cancel</button>
            <button type="submit" disabled={saving} style={ov.btn}>
              {saving ? 'Saving…' : 'Save'}
            </button>
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
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
  },
  modal: { background: '#fff', borderRadius: 12, padding: 24, width: 480, maxWidth: '90vw' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  close: { color: 'var(--c-muted)', cursor: 'pointer' },
  input: { padding: '9px 11px', border: '1px solid #d1d5db', borderRadius: 8, width: '100%' },
  role: { fontSize: 14, display: 'flex', alignItems: 'center', gap: 4,
    border: '1px solid #e5e7eb', padding: '4px 10px', borderRadius: 999 },
  btn: { padding: '9px 18px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none',
    borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { padding: '9px 18px', background: '#fff', border: '1px solid #d1d5db',
    borderRadius: 8, cursor: 'pointer' },
};
