import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth';
import { UnauthorizedPage } from '../components/ErrorPages';

/**
 * Guards child routes. While the app is bootstrapping (silent refresh in flight)
 * we render nothing to avoid redirect flicker. Unauthenticated users are sent to
 * /login with the attempted location preserved. `permission`, if provided,
 * additionally enforces an RBAC check.
 */
export default function ProtectedRoute({ permission }) {
  const { isAuthenticated, status, can } = useAuth();
  const location = useLocation();

  if (status === 'idle' || status === 'bootstrapping') {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permission && !can(permission)) {
    return <UnauthorizedPage />;
  }

  return <Outlet />;
}
