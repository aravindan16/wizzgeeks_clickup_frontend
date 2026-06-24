import { useAuth } from '../features/auth/useAuth';

/**
 * Conditionally renders children if the current user holds the given permission.
 * Usage: <Can permission="user.create"><CreateButton /></Can>
 */
export default function Can({ permission, children, fallback = null }) {
  const { can } = useAuth();
  return can(permission) ? children : fallback;
}
