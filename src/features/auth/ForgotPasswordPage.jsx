import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from './authApi';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await authApi.forgotPassword(email);
    setResult(res);
    setSubmitting(false);
  };

  return (
    <div style={wrap}>
      <form onSubmit={submit} className="card" style={{ width: 380 }}>
        <h2 style={{ marginTop: 0 }}>Forgot password</h2>
        <p style={{ color: '#6b7280', marginTop: -8 }}>We'll send a reset link to your email.</p>
        <input style={inp} type="email" placeholder="you@company.com" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
        <button style={btn} disabled={submitting}>{submitting ? 'Sending…' : 'Send reset link'}</button>

        {result && (
          <div style={{ marginTop: 12, fontSize: 14 }}>
            <p style={{ color: '#166534' }}>{result.message}</p>
            <p style={{ color: '#6b7280' }}>
              Check your email for the reset link. The token is sent only to your inbox — it is never shown here.
            </p>
          </div>
        )}
        <p style={{ fontSize: 13, marginTop: 10 }}><Link to="/login">Back to sign in</Link></p>
      </form>
    </div>
  );
}

const wrap = { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' };
const inp = { padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, width: '100%', marginTop: 8 };
const btn = { marginTop: 14, padding: '10px 12px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', width: '100%' };
