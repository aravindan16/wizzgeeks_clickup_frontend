import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { authApi } from './authApi';
import { googleLogin } from './authSlice';
import GoogleButton from './GoogleButton';
import { useToast } from '../../components/Toast';

export default function RegisterPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const toast = useToast();
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onGoogle = async (credential) => {
    const result = await dispatch(googleLogin(credential));
    if (googleLogin.fulfilled.match(result)) navigate('/');
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const res = await authApi.register(form);
      // Dev convenience: when email sending is disabled the API returns the token,
      // so we can verify immediately. In production the user gets an email instead.
      if (res.verification_token) {
        await authApi.verifyEmail(res.verification_token);
        toast.success('Account created & verified. Please sign in.');
      } else {
        toast.success('Account created. Check your email to verify.');
      }
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <form onSubmit={submit} style={styles.card}>
        <div style={styles.brand}>
          <div style={styles.logoBadge}>
            <img src="/logo.png" alt="Wizzgeeks" style={{ width: 30, height: 30, objectFit: 'contain' }} />
          </div>
          <h1 style={styles.title}>Create your account</h1>
          <p style={styles.sub}>Get started with your Wizzgeeks workspace</p>
        </div>

        <Field label="Full name" value={form.full_name} onChange={(v) => set('full_name', v)}
          placeholder="Jane Doe" autoComplete="name" required />
        <Field label="Email" type="email" value={form.email} onChange={(v) => set('email', v)}
          placeholder="you@company.com" autoComplete="email" required />
        <Field label="Password" type="password" value={form.password} onChange={(v) => set('password', v)}
          placeholder="At least 8 characters" autoComplete="new-password" required minLength={8} />

        {error && <p style={styles.error}>{error}</p>}

        <button style={{ ...styles.button, ...(submitting ? styles.buttonBusy : {}) }} disabled={submitting}>
          {submitting ? 'Creating…' : 'Sign up'}
        </button>

        <GoogleButton onCredential={onGoogle} />

        <p style={styles.footer}>
          Already have an account? <Link to="/login" style={styles.link}>Sign in</Link>
        </p>
      </form>
    </div>
  );
}

function Field({ label, type = 'text', value, onChange, ...rest }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <input style={styles.input} type={type} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    boxSizing: 'border-box',
    background: 'radial-gradient(1100px 520px at 50% -8%, color-mix(in srgb, var(--c-primary) 12%, transparent), transparent), var(--c-bg)',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    boxSizing: 'border-box',
    background: 'var(--c-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 16,
    padding: '32px 30px',
    boxShadow: 'var(--sh-lg)',
    display: 'flex',
    flexDirection: 'column',
  },
  brand: { textAlign: 'center', marginBottom: 20 },
  logoBadge: {
    width: 54, height: 54, borderRadius: 15, marginBottom: 14,
    background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--c-text-strong)' },
  sub: { margin: '6px 0 0', color: 'var(--c-muted)', fontSize: 14 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--c-text)', marginBottom: 6, display: 'block' },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '11px 13px',
    border: '1px solid var(--c-border)', borderRadius: 10, fontSize: 14,
    background: 'var(--c-surface)', color: 'var(--c-text)',
  },
  button: {
    marginTop: 6, padding: '12px', background: 'var(--c-primary)', color: 'var(--c-on-primary)',
    border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', transition: 'filter .12s',
  },
  buttonBusy: { opacity: 0.7, cursor: 'progress' },
  error: {
    color: '#ef4444', fontSize: 13, marginTop: 2, marginBottom: 10,
    background: 'color-mix(in srgb, #ef4444 12%, transparent)', padding: '9px 11px', borderRadius: 8,
  },
  footer: { textAlign: 'center', marginTop: 18, fontSize: 13.5, color: 'var(--c-muted)' },
  link: { color: 'var(--c-primary)', fontWeight: 600, textDecoration: 'none' },
};
