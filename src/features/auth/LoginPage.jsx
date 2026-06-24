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
      <form onSubmit={onSubmit} className="card" style={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <img src="/logo.png" alt="Wizzgeeks" style={{ width: 34, height: 34, objectFit: 'contain' }} />
          <h2 style={{ margin: 0 }}>Wizzgeeks</h2>
        </div>
        <p style={styles.muted}>Sign in to continue</p>

        <label style={styles.label}>Email</label>
        <input
          style={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          required
        />

        <label style={styles.label}>Password</label>
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.button} type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <GoogleButton onCredential={onGoogle} />

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 13 }}>
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/register">Create account</Link>
        </div>
      </form>
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' },
  card: { width: 360, display: 'flex', flexDirection: 'column', gap: 8 },
  muted: { color: '#6b7280', marginTop: -8 },
  label: { fontSize: 13, fontWeight: 600, marginTop: 8 },
  input: { padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 },
  button: {
    marginTop: 16,
    padding: '10px 12px',
    background: '#111827',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: { color: '#991b1b', fontSize: 13, marginTop: 8 },
};
