import { useEffect, useRef, useState } from 'react';
import { usersApi } from '../users/usersApi';
import { authApi } from '../auth/authApi';
import { useToast } from '../../components/Toast';
import PasswordInput from '../../components/PasswordInput';

export default function ProfilePage() {
  const toast = useToast();
  const fileRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [pwd, setPwd] = useState({ current_password: '', new_password: '' });

  const load = () => usersApi.myProfile().then((p) => {
    setProfile(p);
    setForm({ full_name: p.full_name || '', designation: p.designation || '',
      department: p.department || '', timezone: p.timezone || 'UTC' });
  });

  useEffect(() => { load(); }, []);

  if (!profile) return <p>Loading…</p>;

  const saveProfile = async (e) => {
    e.preventDefault();
    // Don't hit the API (or refetch) if nothing actually changed.
    const fields = ['full_name', 'designation', 'department', 'timezone'];
    const changed = fields.some((k) => (form[k] || '') !== (profile[k] || (k === 'timezone' ? 'UTC' : '')));
    if (!changed) { toast.info('No changes to save'); return; }
    try { await usersApi.updateMyProfile(form); toast.success('Profile updated'); load(); }
    catch (err) { toast.error(err.response?.data?.error?.message || 'Update failed'); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    // Validate before calling the API so an empty/invalid submit never hits it.
    const current = pwd.current_password.trim();
    const next = pwd.new_password.trim();
    if (!current || !next) { toast.error('Enter your current and new password'); return; }
    if (next.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (current === next) { toast.error('New password must be different from the current one'); return; }
    try {
      await authApi.changePassword(current, next);
      setPwd({ current_password: '', new_password: '' });
      toast.success('Password changed');
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Change failed'); }
  };

  const onAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { await usersApi.uploadAvatar(file); toast.success('Avatar updated'); load(); }
    catch (err) { toast.error(err.response?.data?.error?.message || 'Upload failed'); }
  };

  return (
    <div>
      <h2>My Profile</h2>
      <div style={grid}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={avatar}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 24 }}>{(profile.full_name || '?')[0]}</span>}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{profile.full_name}</div>
              <div style={{ color: '#6b7280' }}>{profile.email}</div>
              <div style={{ color: '#6b7280', fontSize: 13 }}>{(profile.roles || []).join(', ')}</div>
              <button style={linkBtn} onClick={() => fileRef.current?.click()}>Upload picture</button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatar} />
            </div>
          </div>

          <form onSubmit={saveProfile} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Field label="Full name" value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} />
            <Field label="Designation" value={form.designation} onChange={(v) => setForm((f) => ({ ...f, designation: v }))} />
            <Field label="Department" value={form.department} onChange={(v) => setForm((f) => ({ ...f, department: v }))} />
            <Field label="Timezone" value={form.timezone} onChange={(v) => setForm((f) => ({ ...f, timezone: v }))} />
            <button style={btn} type="submit">Save profile</button>
          </form>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <strong>Change password</strong>
            <form onSubmit={changePassword} style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Field label="Current password" type="password" value={pwd.current_password}
                onChange={(v) => setPwd((p) => ({ ...p, current_password: v }))} />
              <Field label="New password" type="password" value={pwd.new_password}
                onChange={(v) => setPwd((p) => ({ ...p, new_password: v }))} />
              <button style={btn} type="submit">Change password</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, type = 'text', value, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      {type === 'password'
        ? <PasswordInput style={inp} value={value || ''} onChange={(e) => onChange(e.target.value)} />
        : <input style={inp} type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 };
const avatar = { width: 64, height: 64, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const inp = { padding: '9px 11px', border: '1px solid #d1d5db', borderRadius: 8 };
const btn = { marginTop: 6, padding: '9px 16px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' };
const linkBtn = { display: 'block', marginTop: 6, background: 'none', border: 'none', color: '#111827', cursor: 'pointer', padding: 0, fontSize: 13 };
