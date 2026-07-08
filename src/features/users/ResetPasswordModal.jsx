import { useState } from 'react';
import { createPortal } from 'react-dom';
import { usersApi } from './usersApi';
import { useToast } from '../../components/Toast';
import { IconClose } from '../../components/icons';

/**
 * Admin-only "Reset password" dialog. The admin types a new password for a user
 * who forgot theirs; on save the user can sign in immediately with it.
 */
export default function ResetPasswordModal({ open, user, onClose, onDone }) {
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open || !user) return null;

  const close = () => { setPw(''); setConfirm(''); setShow(false); onClose(); };

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (pw !== confirm) { toast.error('Passwords do not match'); return; }
    setBusy(true);
    try {
      await usersApi.resetPassword(user._id, pw);
      toast.success(`Password reset for ${user.full_name}`);
      close();
      onDone?.();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not reset password');
    } finally { setBusy(false); }
  };

  return createPortal(
    <div style={s.backdrop} onMouseDown={close}>
      <form style={s.modal} onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <div style={s.head}>
          <strong style={s.title}>Reset password</strong>
          <button type="button" className="icon-btn" style={s.x} title="Close" onClick={close}><IconClose size={16} /></button>
        </div>

        <p style={s.sub}>Set a new password for <strong>{user.full_name}</strong> ({user.email}). Share it with them so they can sign in.</p>

        <label style={s.label}>New password</label>
        <input style={s.input} type={show ? 'text' : 'password'} value={pw} autoFocus
          placeholder="At least 8 characters" onChange={(e) => setPw(e.target.value)} />

        <label style={s.label}>Confirm password</label>
        <input style={s.input} type={show ? 'text' : 'password'} value={confirm}
          placeholder="Re-enter the password" onChange={(e) => setConfirm(e.target.value)} />

        <label style={s.showRow}>
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password
        </label>

        <div style={s.actions}>
          <button type="button" style={s.ghost} onClick={close}>Cancel</button>
          <button type="submit" style={s.primary} disabled={busy}>{busy ? 'Resetting…' : 'Reset password'}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(16,24,40,.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: 420, maxWidth: '100%', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14,
    boxShadow: '0 24px 60px rgba(0,0,0,.3)', padding: 20, display: 'flex', flexDirection: 'column' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { fontSize: 17, color: 'var(--c-text-strong)' },
  x: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: 'none', color: 'var(--c-muted)', borderRadius: 8, cursor: 'pointer' },
  sub: { fontSize: 13, color: 'var(--c-muted)', margin: '0 0 14px', lineHeight: 1.5 },
  label: { fontSize: 12.5, fontWeight: 600, color: 'var(--c-text-strong)', marginBottom: 5 },
  input: { padding: '9px 11px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface-2)',
    color: 'var(--c-text-strong)', outline: 'none', marginBottom: 12, fontSize: 14 },
  showRow: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--c-muted)', marginBottom: 16, cursor: 'pointer' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8 },
  ghost: { padding: '9px 16px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text-strong)', borderRadius: 8, cursor: 'pointer' },
  primary: { padding: '9px 16px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
};
