import { useEffect, useState } from 'react';
import { starredApi } from './starredApi';
import { STARRED_EVENT } from './starredStore';

/**
 * Reactive read of the current user's starred items. Refreshes when an item is
 * starred/unstarred (via the STARRED_EVENT window event).
 */
export function useStarred(entityType) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let live = true;
    const load = () => starredApi.list(entityType ? { entity_type: entityType } : undefined)
      .then((d) => { if (live) setItems(d || []); }).catch(() => {});
    load();
    window.addEventListener(STARRED_EVENT, load);
    return () => { live = false; window.removeEventListener(STARRED_EVENT, load); };
  }, [entityType]);

  return items;
}
