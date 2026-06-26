import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { login, googleLogin } from './authSlice';
import { useAuth } from './useAuth';
import GoogleButton from './GoogleButton';

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await dispatch(login({ email, password }));
    setSubmitting(false);
    if (login.fulfilled.match(result)) {
      navigate(from, { replace: true });
    }
  };

  const onGoogle = async (credential) => {
    const result = await dispatch(googleLogin(credential));
    if (googleLogin.fulfilled.match(result)) navigate(from, { replace: true });
  };

  return (
    <div style={styles.wrap}>
      <form onSubmit={onSubmit} style={styles.card}>
        <div style={styles.brand}>
          <div style={styles.logoBadge}>
            <img src="/logo.png" alt="Wizzgeeks" style={{ width: 30, height: 30, objectFit: 'contain' }} />
          </div>
          <h1 style={styles.title}>Welcome back</h1>
          <p style={styles.sub}>Sign in to your Wizzgeeks workspace</p>
        </div>

        <label style={styles.label}>Email</label>
        <input
          style={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
          required
        />

        <div style={styles.labelRow}>
          <label style={{ ...styles.label, marginBottom: 0 }}>Password</label>
          <Link to="/forgot-password" style={styles.linkSm}>Forgot?</Link>
        </div>
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />

        {error && <p style={styles.error}>{error}</p>}

        <button style={{ ...styles.button, ...(submitting ? styles.buttonBusy : {}) }} type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <GoogleButton onCredential={onGoogle} />

        <p style={styles.footer}>
          Don&apos;t have an account? <Link to="/register" style={styles.link}>Create account</Link>
        </p>
      </form>
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
  label: { fontSize: 13, fontWeight: 600, color: 'var(--c-text)', marginBottom: 6, display: 'block' },
  labelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 6 },
  linkSm: { fontSize: 12.5, color: 'var(--c-primary)', textDecoration: 'none', fontWeight: 600 },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '11px 13px',
    border: '1px solid var(--c-border)', borderRadius: 10, fontSize: 14,
    background: 'var(--c-surface)', color: 'var(--c-text)', marginBottom: 4,
  },
  button: {
    marginTop: 18, padding: '12px', background: 'var(--c-primary)', color: 'var(--c-on-primary)',
    border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer',
    transition: 'filter .12s',
  },
  buttonBusy: { opacity: 0.7, cursor: 'progress' },
  error: {
    color: '#ef4444', fontSize: 13, marginTop: 12, marginBottom: 0,
    background: 'color-mix(in srgb, #ef4444 12%, transparent)', padding: '9px 11px', borderRadius: 8,
  },
  footer: { textAlign: 'center', marginTop: 18, fontSize: 13.5, color: 'var(--c-muted)' },
  link: { color: 'var(--c-primary)', fontWeight: 600, textDecoration: 'none' },
};
