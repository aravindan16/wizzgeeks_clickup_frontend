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
    <div style={wrap}>
      <form onSubmit={submit} className="card" style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <img src="/logo.png" alt="Wizzgeeks" style={{ width: 34, height: 34, objectFit: 'contain' }} />
          <h2 style={{ margin: 0 }}>Create account</h2>
        </div>
        <Input label="Full name" value={form.full_name} onChange={(v) => set('full_name', v)} required />
        <Input label="Email" type="email" value={form.email} onChange={(v) => set('email', v)} required />
        <Input label="Password" type="password" value={form.password} onChange={(v) => set('password', v)} required minLength={8} />
        {error && <p style={{ color: '#991b1b', fontSize: 13 }}>{error}</p>}
        <button style={btn} disabled={submitting}>{submitting ? 'Creating…' : 'Sign up'}</button>
        <GoogleButton onCredential={onGoogle} />
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 12 }}>Already have an account? <Link to="/login">Sign in</Link></p>
      </form>
    </div>
  );
}

function Input({ label, type = 'text', value, onChange, ...rest }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <input style={inp} type={type} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </label>
  );
}

const wrap = { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' };
const card = { width: 360 };
const inp = { padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 };
const btn = { marginTop: 14, padding: '10px 12px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' };
