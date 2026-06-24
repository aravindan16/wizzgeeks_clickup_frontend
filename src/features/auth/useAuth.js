import { useSelector } from 'react-redux';

/**
 * Convenience hook exposing the current auth state and a permission checker.
 * `can('user.create')` returns true for wildcard ('*') holders too.
 */
export function useAuth() {
  const { user, status, error } = useSelector((s) => s.auth);
  const permissions = user?.permissions || [];
  const roles = user?.roles || [];

  const can = (permission) => permissions.includes('*') || permissions.includes(permission);
  const hasRole = (role) => roles.includes(role);

  return {
    user,
    status,
    error,
    permissions,
    roles,
    isAuthenticated: status === 'authenticated',
    can,
    hasRole,
  };
}
