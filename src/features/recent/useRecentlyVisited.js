import { useEffect, useState } from 'react';
import { recentApi } from './recentApi';
import { RECENT_EVENT } from './recentStore';

/**
 * Reactive read of the current user's recently-visited list from the API.
 * Refreshes when a visit is recorded/cleared (via the RECENT_EVENT window event).
 */
export function useRecentlyVisited() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let live = true;
    const load = () => recentApi.list().then((d) => { if (live) setItems(d || []); }).catch(() => {});
    load();
    window.addEventListener(RECENT_EVENT, load);
    return () => { live = false; window.removeEventListener(RECENT_EVENT, load); };
  }, []);

  return items;
}
