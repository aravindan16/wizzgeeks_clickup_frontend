import { resolveStatuses } from '../tasks/tasksApi';
import { ruleActive } from './filterEval';

/**
 * Option builders for the filter builder's Space-dependent dropdowns (List, Status).
 * Shared by the Filters page and the Export page so both offer identical choices.
 *
 *   projects — Spaces [{ _id, name, key, statuses }]
 *   lists    — Lists  [{ _id, name, spaceId, spaceName, status_mode, statuses }]
 */

// Context Space: the Space (or a List's Space) chosen in a rule — drives List & Status options.
export function findContextSpaceId(cards, lists) {
  let sid = '';
  const scan = (n) => {
    if (sid) return;
    if (n.type === 'group') { n.children.forEach(scan); return; }
    if (n.field === 'space' && ruleActive(n)) sid = String(n.value);
    else if (n.field === 'list' && ruleActive(n)) { const l = lists.find((x) => n.value.map(String).includes(String(x._id))); if (l) sid = String(l.spaceId); }
  };
  cards.forEach(scan);
  return sid;
}

// First selected List (for loading List-scoped custom fields).
export function findContextListId(cards) {
  let lid = '';
  const scan = (n) => { if (lid) return; if (n.type === 'group') n.children.forEach(scan); else if (n.field === 'list' && Array.isArray(n.value) && n.value.length) lid = String(n.value[0]); };
  cards.forEach(scan);
  return lid;
}

export const statusesBySpace = (projects) => {
  const m = {};
  projects.forEach((p) => { m[p._id] = resolveStatuses(p); });
  return m;
};

// A List can have its own custom status set; otherwise it inherits its Space's.
export const listStatuses = (l, stsBySpace) =>
  ((l.status_mode === 'custom' && l.statuses?.length) ? resolveStatuses(l) : (stsBySpace[l.spaceId] || []));

export function buildStatusOptions({ cards, lists, projects, contextSpaceId, stsBySpace }) {
  // Which Lists are selected anywhere in the filter? Base Status on THOSE lists.
  const listIds = new Set();
  const scan = (n) => { if (n.type === 'group') n.children.forEach(scan); else if (n.field === 'list' && Array.isArray(n.value)) n.value.forEach((id) => listIds.add(String(id))); };
  cards.forEach(scan);
  // Group the statuses BY LIST (each list can have its own custom workflow), so the
  // dropdown shows e.g. "DEVELOPMENT → its statuses, EPIC → its statuses, …" with
  // EVERY status listed under each list. Option values are namespaced `${listId}::${key}`
  // so the SAME status key living in two lists stays independently selectable — ticking
  // DEVELOPMENT's status must NOT tick EPIC's copy. The server evaluator understands
  // this `list::key` form (it matches the task's list AND status).
  const grouped = (srcLists) => srcLists.flatMap((l) =>
    listStatuses(l, stsBySpace).map((st) => ({ value: `${l._id}::${st.key}`, label: st.name, group: l.name })));
  if (listIds.size) return grouped(lists.filter((l) => listIds.has(String(l._id))));
  if (contextSpaceId) {
    // A SPACE is selected (no specific List): show every List of the Space, each with
    // its full status set, grouped by List.
    const spaceLists = lists.filter((l) => String(l.spaceId) === contextSpaceId);
    if (spaceLists.length) return grouped(spaceLists);
    return (stsBySpace[contextSpaceId] || []).map((st) => ({ value: st.key, label: st.name }));
  }
  // No space/list chosen → every space's statuses, grouped by SPACE. Each space
  // shows the UNION of its lists' statuses (custom + inherited), deduped per space,
  // so custom statuses like "Ready for deployment" show up too — not just the 3 defaults.
  return projects.flatMap((p) => {
    const spaceLists = lists.filter((l) => String(l.spaceId) === p._id);
    const seen = {}; const out = [];
    const add = (arr) => arr.forEach((st) => { if (!seen[st.key]) { seen[st.key] = 1; out.push({ value: st.key, label: st.name, group: p.name || p.key }); } });
    if (spaceLists.length) spaceLists.forEach((l) => add(listStatuses(l, stsBySpace)));
    else add(stsBySpace[p._id] || []);
    return out;
  });
}

export function buildListOptions(lists, contextSpaceId) {
  // A Space is chosen → just its Lists (flat). Otherwise group the Lists BY SPACE
  // (space name as the header) so the dropdown reads "Opbook360AI → its lists, …".
  if (contextSpaceId) {
    return lists.filter((l) => String(l.spaceId) === contextSpaceId).map((l) => ({ value: l._id, label: l.name }));
  }
  return [...lists]
    .sort((a, b) => (a.spaceName || '').localeCompare(b.spaceName || '') || (a.name || '').localeCompare(b.name || ''))
    .map((l) => ({ value: l._id, label: l.name, group: l.spaceName }));
}
