import { useEffect } from 'react';
import { recordRecent } from './recentStore';

/**
 * Record a visit to an entity page (e.g. a specific project/task) once its data
 * has loaded. Pass `null` while loading; the effect re-runs when path/name resolve.
 *
 * @param {{ path: string, name: string, type?: string, icon?: string, id?: string } | null} item
 */
export function useTrackVisit(item) {
  const path = item?.path;
  const name = item?.name;

  useEffect(() => {
    if (path && name) {
      recordRecent(item);
    }
    // Re-run only when the identity changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, name]);
}
