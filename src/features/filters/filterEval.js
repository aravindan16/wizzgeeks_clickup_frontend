/**
 * Client-side evaluation of a saved-filter builder tree (`cards` + `conj`) against
 * a task. Shared by the Filters page and dashboard cards that use a saved filter.
 */
export const ruleActive = (r) => (Array.isArray(r.value) ? r.value.length > 0 : (r.value !== '' && r.value != null));
export const nodeActive = (n) => (n.type === 'group' ? n.children.some(nodeActive) : ruleActive(n));

export function evalNode(node, t, ctx = {}) {
  if (node.type === 'group') {
    const kids = node.children.filter(nodeActive);
    if (!kids.length) return true;
    const res = kids.map((k) => evalNode(k, t, ctx));
    return node.conj === 'OR' ? res.some(Boolean) : res.every(Boolean);
  }
  if (!ruleActive(node)) return true;
  const neg = node.op === 'is_not';
  let m = true;
  if (node.field.startsWith('cf:')) {
    const cfId = node.field.slice(3);
    const tv = (t.custom_fields || {})[cfId];
    if (Array.isArray(node.value)) {
      const tvArr = Array.isArray(tv) ? tv.map(String) : (tv != null && tv !== '' ? [String(tv)] : []);
      m = node.value.map(String).some((v) => tvArr.includes(v));
    } else {
      m = String(tv ?? '').toLowerCase().includes(String(node.value).toLowerCase());
    }
    return neg ? !m : m;
  }
  const vals = Array.isArray(node.value) ? node.value.map(String) : [String(node.value)];
  switch (node.field) {
    case 'space': m = String(t.project_id) === String(node.value); break;
    case 'list': m = vals.includes(String(t.list_id)); break;
    case 'type': m = vals.includes(String(t.type || 'task')); break;
    case 'status': m = vals.includes(String(t.status)); break;
    case 'assignee':
      m = vals.some((v) => (v === '__unassigned__' ? !t.assignee_id
        : v === '__me__' ? String(t.assignee_id) === String(ctx.myId)
          : String(t.assignee_id) === v)); break;
    case 'reporter':
      m = vals.some((v) => (v === '__me__' ? String(t.reporter_id) === String(ctx.myId)
        : String(t.reporter_id) === v)); break;
    case 'label': m = (t.labels || []).some((l) => vals.includes(String(l))); break;
    default: m = true;
  }
  return neg ? !m : m;
}

/** Filter a task list by a saved filter's cards + cross-card conjunction. */
export function filterTasks(tasks, cards, conj = 'AND', ctx = {}) {
  const active = (cards || []).filter(nodeActive);
  if (!active.length) return tasks;
  return tasks.filter((t) => (conj === 'OR'
    ? active.some((c) => evalNode(c, t, ctx))
    : active.every((c) => evalNode(c, t, ctx))));
}
