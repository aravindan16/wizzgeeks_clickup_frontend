// Per-Space view tabs (List / Board / Table), persisted in localStorage.
// Each view remembers its own name, type and FILTER set, so a filter you apply
// stays applied across reloads, renames and view switches (ClickUp-style).
const KEY = (spaceId) => `wg_views_${spaceId}`;
const emptyFilters = () => ({ assignee: [], status: [], type: [], priority: [], label: [] });
const uid = () => `v${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

// Only these three view types are offered (per the design).
export const VIEW_TYPES = [
  { type: 'list', label: 'List' },
  { type: 'board', label: 'Board' },
  { type: 'table', label: 'Table' },
];

export function defaultViews() {
  // builtin views can be renamed/filtered but NOT deleted.
  return [
    { id: 'list', name: 'List', type: 'list', filters: emptyFilters(), builtin: true },
    { id: 'board', name: 'Board', type: 'board', filters: emptyFilters(), builtin: true },
  ];
}

// A view is undeletable if it's flagged builtin or is one of the original ids
// (covers views saved before the builtin flag existed).
export function isBuiltinView(v) {
  return !!v && (v.builtin === true || v.id === 'list' || v.id === 'board');
}

export function loadViews(spaceId) {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(spaceId)));
    if (Array.isArray(raw) && raw.length) {
      return raw.map((v) => ({ ...v, filters: { ...emptyFilters(), ...(v.filters || {}) } }));
    }
  } catch { /* ignore corrupt storage */ }
  return defaultViews();
}

export function saveViews(spaceId, views) {
  try { localStorage.setItem(KEY(spaceId), JSON.stringify(views)); } catch { /* ignore */ }
}

export function newView(type) {
  const label = (VIEW_TYPES.find((t) => t.type === type) || {}).label || 'View';
  return { id: uid(), name: label, type, filters: emptyFilters() };
}
