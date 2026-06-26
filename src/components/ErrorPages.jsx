import { Link } from 'react-router-dom';

function Shell({ code, title, message }) {
  return (
    <div style={wrap}>
      <img src="/logo.png" alt="Wizzgeeks" style={{ width: 56, height: 56, objectFit: 'contain', marginBottom: 12 }} />
      <div style={{ fontSize: 64, fontWeight: 800, color: '#111827' }}>{code}</div>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <p style={{ color: '#6b7280' }}>{message}</p>
      <Link to="/" style={btn}>Go to Dashboard</Link>
    </div>
  );
}

export function NotFoundPage() {
  return <Shell code="404" title="Page not found" message="The page you're looking for doesn't exist." />;
}

export function UnauthorizedPage() {
  return <Shell code="403" title="Unauthorized" message="You don't have permission to access this page." />;
}

const wrap = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  minHeight: '70vh', textAlign: 'center' };
const btn = { marginTop: 16, padding: '10px 18px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', borderRadius: 8,
  textDecoration: 'none', fontWeight: 600 };
