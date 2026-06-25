import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { recordRecent } from './recentStore';

/**
 * Auto-records top-level page visits on every navigation. Dynamic entity routes
 * (/projects/:id, /tasks/:id) are intentionally omitted here — their pages record
 * a richer entry (with the real entity name) via useTrackVisit, which dedupes by path.
 *
 * Rendered once inside the authenticated AppLayout.
 */
const ROUTE_META = {
  '/': { name: 'Dashboard', type: 'Dashboard', icon: '📊' },
  '/team-activity': { name: 'Team Activity', type: 'Page', icon: '🧑‍🤝‍🧑' },
  '/projects': { name: 'Spaces', type: 'Page', icon: '🗂️' },
  '/reports': { name: 'Reports', type: 'Page', icon: '📈' },
  '/users': { name: 'Users', type: 'Page', icon: '👤' },
  '/audit': { name: 'Audit Log', type: 'Page', icon: '🛡️' },
  '/settings': { name: 'Settings', type: 'Page', icon: '⚙️' },
  '/profile': { name: 'Profile', type: 'Page', icon: '👤' },
};

export default function RouteTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = ROUTE_META[pathname];
    if (meta) recordRecent({ path: pathname, ...meta });
  }, [pathname]);

  return null;
}
