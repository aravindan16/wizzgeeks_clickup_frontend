import { recentApi } from './recentApi';

/**
 * Recently-visited is stored PER USER in the database (not localStorage), so each
 * account only ever sees its own history. These helpers wrap the API and emit a
 * window event so any mounted <RecentlyVisited>/<RecentMenu> refreshes.
 */
export const RECENT_EVENT = 'wg:recent-updated';

function emit() {
  window.dispatchEvent(new CustomEvent(RECENT_EVENT));
}

/** Record (or refresh) a visited item for the current user. Best-effort. */
export async function recordRecent(item) {
  if (!item || !item.path || !item.name) return;
  try {
    await recentApi.record({
      path: item.path, name: item.name, type: item.type, icon: item.icon,
    });
    emit();
  } catch {
    /* unauthenticated or offline — ignore, feature is best-effort */
  }
}

export async function clearRecent() {
  try {
    await recentApi.clear();
    emit();
  } catch {
    /* ignore */
  }
}
