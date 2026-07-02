// Card factory + one-time migration of pre-DB localStorage dashboards.
// Dashboards themselves now live in the backend (see dashboardsApi.js).
const cid = () => `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

// type: 'portfolio' | 'line' | 'bar' | 'pie' | 'calculation'
// payload: { source: 'lists'|'tasks', lists: [{id,name,spaceId,spaceName}], tasks: [{id,title,spaceId,listId,listName,spaceName}] }
export function newCard(type, payload, title) {
  const p = payload || {};
  return {
    id: cid(),
    type: type || 'portfolio',
    title: title || 'Portfolio',
    source: p.source || 'lists',
    lists: p.lists || [],
    tasks: p.tasks || [],
    xMeasure: p.xMeasure || 'status', // chart X-axis grouping: status | priority | list
    xShow: p.xShow || [],             // which X categories to show ([] = all)
  };
}

// --- Legacy localStorage dashboards (pre-DB) — read once to migrate into the DB. ---
const LEGACY_KEY = (uid) => `wg_dashboards_${uid || 'me'}`;
export function loadLegacyDashboards(uid) {
  try {
    const r = JSON.parse(localStorage.getItem(LEGACY_KEY(uid)));
    return Array.isArray(r) ? r : [];
  } catch { return []; }
}
export function clearLegacyDashboards(uid) {
  try { localStorage.removeItem(LEGACY_KEY(uid)); } catch { /* ignore */ }
}
