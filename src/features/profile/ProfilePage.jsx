import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch } from 'react-redux';
import { Camera } from 'lucide-react';
import { usersApi } from '../users/usersApi';
import { authApi } from '../auth/authApi';
import { patchUser } from '../auth/authSlice';
import { useToast } from '../../components/Toast';
import { useHeaderSlot } from '../../layouts/headerSlot';
import PasswordInput from '../../components/PasswordInput';

// ClickUp-style avatar color palette.
export const AVATAR_COLORS = [
  '#7c3aed', '#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308', '#f59e0b',
  '#ef4444', '#f43f5e', '#ec4899', '#a855f7', '#78716c', '#6b7280', '#111827',
];
export const DEFAULT_AVATAR_COLOR = '#f59e0b';
// Same initials logic as the topbar avatar (up to two letters), so both match.
const initials = (n) => (n || '?').split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function ProfilePage() {
  const toast = useToast();
  const slotEl = useHeaderSlot();
  const dispatch = useDispatch();
  const fileRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm_password: '' });

  const load = () => usersApi.myProfile().then((p) => {
    setProfile(p);
    setForm({ full_name: p.full_name || '' });
  });

  useEffect(() => { load(); }, []);

  if (!profile) return <p>Loading…</p>;

  const saveProfile = async (e) => {
    e.preventDefault();
    if ((form.full_name || '') === (profile.full_name || '')) { toast.info('No changes to save'); return; }
    try {
      await usersApi.updateMyProfile({ full_name: form.full_name });
      dispatch(patchUser({ full_name: form.full_name })); // keep the topbar avatar/name in sync
      toast.success('Profile updated'); load();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Update failed'); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    const current = pwd.current_password.trim();
    const next = pwd.new_password.trim();
    const confirm = pwd.confirm_password.trim();
    if (!current || !next) { toast.error('Enter your current and new password'); return; }
    if (next.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (next !== confirm) { toast.error('New password and confirm password do not match'); return; }
    if (current === next) { toast.error('New password must be different from the current one'); return; }
    try {
      await authApi.changePassword(current, next);
      setPwd({ current_password: '', new_password: '', confirm_password: '' });
      toast.success('Password changed');
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Change failed'); }
  };

  const onAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const p = await usersApi.uploadAvatar(file); toast.success('Avatar updated'); dispatch(patchUser({ avatar_url: p.avatar_url })); load(); }
    catch (err) { toast.error(err.response?.data?.error?.message || 'Upload failed'); }
  };

  const pickColor = async (color) => {
    setProfile((p) => ({ ...p, avatar_color: color }));
    dispatch(patchUser({ avatar_color: color }));
    try { await usersApi.updateMyProfile({ avatar_color: color }); }
    catch (err) { toast.error(err.response?.data?.error?.message || 'Could not set color'); load(); }
  };

  const roleText = (profile.roles || []).join(', ') || '—';
  const avatarBg = profile.avatar_color || DEFAULT_AVATAR_COLOR;

  return (
    <div>
      {slotEl && createPortal(<span style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-strong)' }}>My Profile</span>, slotEl)}
      <div style={grid}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Avatar with a camera badge — click anywhere to change the picture. */}
            <button type="button" style={avatarBtn} onClick={() => fileRef.current?.click()} title="Change picture">
              <span style={{ ...avatar, background: profile.avatar_url ? 'var(--c-surface-2)' : avatarBg }}>
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt="avatar" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{initials(profile.full_name)}</span>}
              </span>
              <span style={cameraBadge}><Camera size={14} /></span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatar} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--c-text-strong)' }}>{profile.full_name}</div>
              <div style={{ color: 'var(--c-muted)' }}>{profile.email}</div>
            </div>
          </div>

          {/* Avatar color palette (used for the initials avatar). */}
          {!profile.avatar_url && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--c-muted)', marginBottom: 8 }}>Color</div>
              <div style={swatchGrid}>
                {AVATAR_COLORS.map((c) => (
                  <button key={c} type="button" title={c} onClick={() => pickColor(c)}
                    style={{ ...swatch, background: c, ...(avatarBg.toLowerCase() === c.toLowerCase() ? swatchActive : {}) }} />
                ))}
              </div>
            </div>
          )}

          <form onSubmit={saveProfile} style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="Full name" value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} />
            <Field label="Role" value={roleText} disabled />
            <button style={btn} type="submit">Save profile</button>
          </form>
        </div>

        <div>
          <div className="card">
            <strong>Change password</strong>
            <form onSubmit={changePassword} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Field label="Current password" type="password" value={pwd.current_password}
                onChange={(v) => setPwd((p) => ({ ...p, current_password: v }))} />
              <Field label="New password" type="password" value={pwd.new_password}
                onChange={(v) => setPwd((p) => ({ ...p, new_password: v }))} />
              <Field label="Confirm new password" type="password" value={pwd.confirm_password}
                onChange={(v) => setPwd((p) => ({ ...p, confirm_password: v }))} />
              <button style={btn} type="submit">Change password</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, type = 'text', value, onChange, disabled }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-strong)' }}>{label}</span>
      {type === 'password'
        ? <PasswordInput style={inp} value={value || ''} onChange={(e) => onChange(e.target.value)} />
        : <input style={{ ...inp, ...(disabled ? disabledInp : {}) }} type={type} value={value || ''}
            disabled={disabled} onChange={(e) => onChange?.(e.target.value)} />}
    </label>
  );
}

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 };
const avatarBtn = { position: 'relative', border: 'none', background: 'none', padding: 0, cursor: 'pointer', flexShrink: 0, borderRadius: '50%' };
const avatar = { width: 72, height: 72, borderRadius: '50%', background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' };
const cameraBadge = { position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: '50%', background: 'var(--c-primary)',
  color: 'var(--c-on-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--c-surface)' };
const swatchGrid = { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8, maxWidth: 320 };
const swatch = { width: 28, height: 28, borderRadius: '50%', border: '2px solid transparent', cursor: 'pointer', padding: 0 };
const swatchActive = { boxShadow: '0 0 0 2px var(--c-surface), 0 0 0 4px var(--c-text-strong)' };
const inp = { padding: '9px 11px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)', color: 'var(--c-text-strong)', outline: 'none' };
const disabledInp = { background: 'var(--c-surface-2)', color: 'var(--c-muted)', cursor: 'not-allowed', textTransform: 'capitalize' };
const btn = { marginTop: 6, padding: '9px 16px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' };
