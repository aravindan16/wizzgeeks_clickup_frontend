import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from './authApi';
import { useToast } from '../../components/Toast';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      await authApi.resetPassword(token, password);
      toast.success('Password reset. Please sign in.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Reset failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={wrap}>
      <form onSubmit={submit} className="card" style={{ width: 380 }}>
        <h2 style={{ marginTop: 0 }}>Reset password</h2>
        <label style={lbl}>Reset token</label>
        <input style={inp} value={token} onChange={(e) => setToken(e.target.value)} required />
        <label style={lbl}>New password</label>
        <input style={inp} type="password" value={password} minLength={8}
          onChange={(e) => setPassword(e.target.value)} required />
        {error && <p style={{ color: '#991b1b', fontSize: 13 }}>{error}</p>}
        <button style={btn} disabled={submitting}>{submitting ? 'Resetting…' : 'Reset password'}</button>
        <p style={{ fontSize: 13, marginTop: 10 }}><Link to="/login">Back to sign in</Link></p>
      </form>
    </div>
  );
}

const wrap = { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' };
const lbl = { fontSize: 13, fontWeight: 600, marginTop: 8, display: 'block' };
const inp = { padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, width: '100%', marginTop: 4 };
const btn = { marginTop: 14, padding: '10px 12px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', width: '100%' };
