import { starredApi } from './starredApi';

/**
 * Per-user starred items, stored in the database. These helpers wrap the API and
 * emit a window event so any mounted <StarredMenu>/star button refreshes.
 */
export const STARRED_EVENT = 'wg:starred-updated';

function emit() {
  window.dispatchEvent(new CustomEvent(STARRED_EVENT));
}

export async function starItem(item) {
  if (!item || !item.entity_id || !item.path || !item.name) return;
  try {
    await starredApi.star({
      entity_type: item.entity_type || 'space',
      entity_id: item.entity_id, path: item.path, name: item.name, icon: item.icon,
    });
    emit();
  } catch {
    /* ignore — best effort */
  }
}

export async function unstarItem(entityType, entityId) {
  try {
    await starredApi.unstar(entityType || 'space', entityId);
    emit();
  } catch {
    /* ignore */
  }
}
