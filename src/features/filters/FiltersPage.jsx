import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { tasksApi, resolveStatuses, statusLabel, statusColor, PRIORITY_COLOR } from '../tasks/tasksApi';
import { projectsApi } from '../projects/projectsApi';
import { listsApi } from '../lists/listsApi';
import { dashboardsApi } from '../dashboard/dashboardsApi';
import { customFieldsApi } from '../customfields/customFieldsApi';
import { savedFiltersApi } from './savedFiltersApi';
import { useAuth } from '../auth/useAuth';
import { usePrompt } from '../../components/ConfirmDialog';
import Select from '../../components/Select';
import { IconFilter, IconTrash, IconPlus, IconChevronDown, IconSearch, IconUser } from '../../components/icons';

/**
 * ClickUp-style advanced Filters page: a recursive AND/OR builder over every task
 * across all Spaces. Rules filter client-side so we can combine fields the list
 * endpoint doesn't natively support (multi-List, task type, reporter, nesting).
 */
const OPS = [{ value: 'is', label: 'Is' }, { value: 'is_not', label: 'Is not' }];
const TASK_TYPES = [{ value: 'task', label: 'Task' }, { value: 'bug', label: 'Bug' }, { value: 'subtask', label: 'Subtask' }];
const FIELDS = [
  { key: 'space', label: 'Space' },
  { key: 'list', label: 'List' },
  { key: 'type', label: 'Task type' },
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'reporter', label: 'Reporter' },
];
// Every field except Space is multi-select (value = array); Space stays a single id.
const MULTI_FIELDS = new Set(['list', 'type', 'status', 'assignee', 'reporter']);
const emptyValue = (field) => (MULTI_FIELDS.has(field) ? [] : '');
let _seq = 0;
const nid = () => `n${_seq++}`;
const mkRule = (field = 'status') => ({ id: nid(), type: 'rule', field, op: 'is', value: emptyValue(field) });
const mkGroup = (field) => ({ id: nid(), type: 'group', conj: 'AND', children: [mkRule(field)] });
const newRule = () => mkRule('status');
const newGroup = () => mkGroup('status');
// Fields already used somewhere in a card (each field may be chosen only once).
const collectFields = (node, set = new Set()) => {
  if (node.type === 'group') node.children.forEach((c) => collectFields(c, set));
  else set.add(node.field);
  return set;
};
const hasId = (node, id) => node.id === id || (node.type === 'group' && node.children.some((c) => hasId(c, id)));
const firstUnusedField = (used) => (FIELDS.find((f) => !used.has(f.key)) || FIELDS[0]).key;

/* ---------- immutable tree helpers (find/replace/remove by id) ---------- */
const mapTree = (node, id, fn) => {
  if (node.id === id) return fn(node);
  if (node.type === 'group') return { ...node, children: node.children.map((c) => mapTree(c, id, fn)) };
  return node;
};
const removeFromTree = (node, id) => {
  if (node.type !== 'group') return node;
  const children = node.children
    .filter((c) => c.id !== id)
    .map((c) => removeFromTree(c, id))
    .filter((c) => !(c.type === 'group' && c.children.length === 0)); // drop groups left empty
  return { ...node, children };
};
const ruleActive = (r) => (Array.isArray(r.value) ? r.value.length > 0 : (r.value !== '' && r.value != null));
const nodeActive = (n) => (n.type === 'group' ? n.children.some(nodeActive) : ruleActive(n));

export default function FiltersPage() {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const { user } = useAuth();
  const myId = user?._id || user?.id || '';
  const [projects, setProjects] = useState([]);
  const [lists, setLists] = useState([]);     // {_id, name, spaceId, spaceName}
  const [users, setUsers] = useState([]);     // {user_id, full_name, email}
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  // Each "card" is an independent filter group; the bottom "+ Add filter" adds a card.
  const [cards, setCards] = useState(() => [newGroup()]);
  const [cardsConj, setCardsConj] = useState('AND'); // AND / OR join BETWEEN cards

  useEffect(() => {
    (async () => {
      const ps = (await projectsApi.list({ limit: 200 }).catch(() => ({ items: [] }))).items || [];
      setProjects(ps);
      const perSpace = await Promise.all(ps.map((p) =>
        listsApi.forSpace(p._id).then((ls) => (ls || []).map((l) => ({ ...l, spaceId: p._id, spaceName: p.name || p.key }))).catch(() => [])));
      setLists(perSpace.flat());
      dashboardsApi.searchUsers('').then((u) => setUsers(Array.isArray(u) ? u : (u?.items || []))).catch(() => setUsers([]));
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The list endpoint caps limit at 200 — page through so filtering sees every task.
      const PAGE = 200, CAP = 2000;
      const all = [];
      for (let skip = 0; skip < CAP; skip += PAGE) {
        const r = await tasksApi.list({ limit: PAGE, skip }).catch(() => ({ items: [], total: 0 }));
        const items = r.items || [];
        all.push(...items);
        if (items.length < PAGE || all.length >= (r.total || 0)) break;
      }
      setTasks(all);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Route-driven: /filters/:id loads that saved filter; /filters/new is a fresh
  // builder. Each saved filter has its OWN url so they don't collide.
  useEffect(() => {
    if (routeId && routeId !== 'new') {
      savedFiltersApi.get(routeId).then((sf) => {
        setCards(sf.cards?.length ? sf.cards : [newGroup()]);
        setCardsConj(sf.conj || 'AND');
        markActiveFilter(routeId);
      }).catch(() => { navigate('/filters', { replace: true }); });
    } else {
      setCards([newGroup()]);
      setCardsConj('AND');
      markActiveFilter('');
    }
  }, [routeId]); // eslint-disable-line

  // Context Space: the Space (or a List's Space) chosen in a rule — drives List & Status options.
  const contextSpaceId = useMemo(() => {
    let sid = '';
    const scan = (n) => {
      if (sid) return;
      if (n.type === 'group') { n.children.forEach(scan); return; }
      if (n.field === 'space' && ruleActive(n)) sid = String(n.value);
      else if (n.field === 'list' && ruleActive(n)) { const l = lists.find((x) => n.value.map(String).includes(String(x._id))); if (l) sid = String(l.spaceId); }
    };
    cards.forEach(scan);
    return sid;
  }, [cards, lists]);

  // First selected List (for loading List-scoped custom fields).
  const contextListId = useMemo(() => {
    let lid = '';
    const scan = (n) => { if (lid) return; if (n.type === 'group') n.children.forEach(scan); else if (n.field === 'list' && Array.isArray(n.value) && n.value.length) lid = String(n.value[0]); };
    cards.forEach(scan);
    return lid;
  }, [cards]);

  // Custom fields (dropdown/text/relationship) of the chosen Space — filterable too.
  const [customFields, setCustomFields] = useState([]);
  useEffect(() => {
    if (!contextSpaceId) { setCustomFields([]); return; }
    customFieldsApi.list(contextSpaceId, contextListId || undefined, undefined, { _silent: true })
      .then((fs) => setCustomFields((fs || [])
        .filter((f) => ['dropdown', 'text', 'relationship'].includes(f.type))
        .map((f) => ({ key: `cf:${f._id}`, id: f._id, label: f.name, type: f.type, config: f.config || {} }))))
      .catch(() => setCustomFields([]));
  }, [contextSpaceId, contextListId]);

  const stsBySpace = useMemo(() => { const m = {}; projects.forEach((p) => { m[p._id] = resolveStatuses(p); }); return m; }, [projects]);
  // A List can have its own custom status set; otherwise it inherits its Space's.
  const listStatuses = (l) => ((l.status_mode === 'custom' && l.statuses?.length) ? resolveStatuses(l) : (stsBySpace[l.spaceId] || []));
  // Statuses to resolve a task's label/colour: its List's custom set (if any) + its Space's.
  const stsForTask = (t) => {
    const base = stsBySpace[t.project_id] || [];
    const l = lists.find((x) => String(x._id) === String(t.list_id));
    if (!(l && l.status_mode === 'custom' && l.statuses?.length)) return base;
    const merged = resolveStatuses(l).slice();
    const keys = new Set(merged.map((s) => s.key));
    base.forEach((s) => { if (!keys.has(s.key)) merged.push(s); });
    return merged;
  };

  const statusOptions = useMemo(() => {
    // Which Lists are selected anywhere in the filter? Base Status on THOSE lists.
    const listIds = new Set();
    const scan = (n) => { if (n.type === 'group') n.children.forEach(scan); else if (n.field === 'list' && Array.isArray(n.value)) n.value.forEach((id) => listIds.add(String(id))); };
    cards.forEach(scan);
    const seen = {}; const out = [];
    const add = (arr) => arr.forEach((st) => { if (!seen[st.key]) { seen[st.key] = 1; out.push({ value: st.key, label: st.name }); } });
    if (listIds.size) { lists.filter((l) => listIds.has(String(l._id))).forEach((l) => add(listStatuses(l))); return out; }
    if (contextSpaceId) { add(stsBySpace[contextSpaceId] || []); return out; }
    Object.values(stsBySpace).forEach(add);
    return out;
  }, [cards, lists, contextSpaceId, stsBySpace]);

  const listOptions = useMemo(() => {
    const src = contextSpaceId ? lists.filter((l) => String(l.spaceId) === contextSpaceId) : lists;
    return src.map((l) => ({ value: l._id, label: contextSpaceId ? l.name : `${l.spaceName} / ${l.name}` }));
  }, [contextSpaceId, lists]);
  const userName = (id) => users.find((u) => String(u.user_id) === String(id))?.full_name || users.find((u) => String(u.user_id) === String(id))?.email || '—';
  const spaceName = (id) => projects.find((p) => String(p._id) === String(id))?.name || projects.find((p) => String(p._id) === String(id))?.key || '—';

  const ctx = { myId, lists };
  const filtered = useMemo(() => {
    const active = cards.filter(nodeActive);
    if (!active.length) return tasks;
    // Cards are joined by the chosen AND/OR conjunction.
    return tasks.filter((t) => cardsConj === 'OR'
      ? active.some((c) => evalNode(c, t, ctx))
      : active.every((c) => evalNode(c, t, ctx)));
  }, [tasks, cards, cardsConj, myId, lists]);

  /* card + tree mutations (ids are unique across all cards) */
  const setNode = (id, fn) => setCards((cs) => cs.map((c) => mapTree(c, id, fn)));
  const removeNode = (id) => setCards((cs) => {
    const next = cs.map((c) => removeFromTree(c, id)).filter((c) => c.children.length > 0);
    return next.length ? next : [newGroup()]; // always keep at least one card
  });
  // New rows default to the first field not yet used in that card (no re-picking).
  const addToCard = (groupId, make) => setCards((cs) => cs.map((card) => {
    if (!hasId(card, groupId)) return card;
    const field = firstUnusedField(collectFields(card));
    return mapTree(card, groupId, (g) => ({ ...g, children: [...g.children, make(field)] }));
  }));
  const addRule = (groupId) => addToCard(groupId, mkRule);
  const addNested = (groupId) => addToCard(groupId, mkGroup);
  const addCard = () => setCards((cs) => [...cs, newGroup()]);
  // Set a rule's value; changing Space clears dependent List+Status in that card,
  // and changing List clears Status (their option sets no longer apply).
  const setValue = (ruleId, field, value) => setCards((cs) => cs.map((card) => {
    if (!hasId(card, ruleId)) return card;
    const clear = field === 'space' ? new Set(['list', 'status']) : field === 'list' ? new Set(['status']) : null;
    const transform = (node) => {
      if (node.type === 'group') return { ...node, children: node.children.map(transform) };
      if (node.id === ruleId) return { ...node, value };
      if (clear && clear.has(node.field)) return { ...node, value: emptyValue(node.field) };
      return node;
    };
    return transform(card);
  }));
  const clearAll = () => { setCards([newGroup()]); setCardsConj('AND'); markActiveFilter(''); };

  const options = { projects, lists: listOptions, statuses: statusOptions, users, myId, customFields, tasks };

  return (
    <div>
      <div style={s.header}>
        <h2 style={s.title}><span style={s.titleIcon}><IconFilter size={20} /></span>Filters</h2>
      </div>

      <div className="wg-card" style={s.builder}>
        <div style={s.builderHead}>
          <span style={s.builderTitle}>Filters</span>
          <SavedFilters cards={cards} conj={cardsConj} />
        </div>
        {cards.map((card, ci) => (
          <div key={card.id} style={s.cardBlock}>
            {ci > 0 && (
              <div style={s.cardDivider}>
                {ci === 1
                  ? <div style={{ width: 84 }}><Select value={cardsConj} onChange={setCardsConj} options={AND_OR} /></div>
                  : <span style={s.cardDividerText}>{cardsConj}</span>}
              </div>
            )}
            <FilterGroup node={card} setNode={setNode} removeNode={removeNode} onValue={setValue}
              addRule={addRule} addNested={addNested} options={options} usedFields={collectFields(card)} isRoot />
          </div>
        ))}
        <div style={s.builderFooter}>
          <button type="button" className="btn" style={g.addFilter} onClick={addCard}>
            <IconPlus size={14} /> Add filter
          </button>
          <button type="button" className="btn" style={s.clearAllBtn} onClick={clearAll}>Clear all</button>
        </div>
      </div>

      <div className="wg-card" style={s.results}>
        <div style={s.resultsHead}>{loading ? 'Loading…' : `${filtered.length} task${filtered.length === 1 ? '' : 's'}`}</div>
        <table style={s.table}>
          <thead>
            <tr><Th w={90}>Key</Th><Th>Title</Th><Th w={160}>Space</Th><Th w={130}>Status</Th>
              <Th w={150}>Assignee</Th><Th w={110}>Due date</Th><Th w={100}>Priority</Th></tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 && <tr><td colSpan={7} style={s.empty}>No tasks match these filters.</td></tr>}
            {filtered.map((t) => {
              const sts = stsForTask(t);
              const due = t.end_date || t.due_date;
              return (
                <tr key={t._id} className="wg-rel-row" style={s.row} onClick={() => navigate(`/tasks/${t._id}`)}>
                  <Td><span style={s.key}>{t.key}</span></Td>
                  <Td><span style={s.name}>{t.title}</span></Td>
                  <Td><span style={s.muted}>{spaceName(t.project_id)}</span></Td>
                  <Td><span style={{ ...s.chip, color: statusColor(sts, t.status), borderColor: statusColor(sts, t.status) }}>{statusLabel(sts, t.status)}</span></Td>
                  <Td><span style={s.muted}>{t.assignee_id ? userName(t.assignee_id) : 'Unassigned'}</span></Td>
                  <Td><span style={s.muted}>{due ? new Date(`${due}T00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}</span></Td>
                  <Td><span style={{ color: PRIORITY_COLOR[t.priority] || 'var(--c-muted)', fontWeight: 600, textTransform: 'capitalize' }}>{t.priority || '—'}</span></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------ client-side evaluation */
function evalNode(node, t, ctx) {
  if (node.type === 'group') {
    const kids = node.children.filter(nodeActive);
    if (!kids.length) return true;
    const res = kids.map((k) => evalNode(k, t, ctx));
    return node.conj === 'OR' ? res.some(Boolean) : res.every(Boolean);
  }
  if (!ruleActive(node)) return true;
  const neg = node.op === 'is_not';
  let m = true;
  // Custom field: compare against the value stored on task.custom_fields[<id>].
  if (node.field.startsWith('cf:')) {
    const cfId = node.field.slice(3);
    const tv = (t.custom_fields || {})[cfId];
    if (Array.isArray(node.value)) { // dropdown (labels) / relationship (ids)
      const tvArr = Array.isArray(tv) ? tv.map(String) : (tv != null && tv !== '' ? [String(tv)] : []);
      m = node.value.map(String).some((v) => tvArr.includes(v));
    } else { // text — contains
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
      m = vals.some((v) => v === '__unassigned__' ? !t.assignee_id
        : v === '__me__' ? String(t.assignee_id) === String(ctx.myId)
          : String(t.assignee_id) === v); break;
    case 'reporter':
      m = vals.some((v) => v === '__me__' ? String(t.reporter_id) === String(ctx.myId)
        : String(t.reporter_id) === v); break;
    default: m = true;
  }
  return neg ? !m : m;
}

/* --------------------------------------------------------- group (recursive) */
const AND_OR = [{ value: 'AND', label: 'AND' }, { value: 'OR', label: 'OR' }];

// Left "Where / AND / OR" column — aligned to the same width on every row.
function Connector({ i, conj, onConj }) {
  return (
    <div style={g.connCol}>
      {i === 0 ? <span style={g.where}>Where</span>
        : i === 1 ? <Select value={conj} onChange={onConj} options={AND_OR} />
          : <span style={g.conjText}>{conj}</span>}
    </div>
  );
}

function FilterGroup({ node, setNode, removeNode, onValue, addRule, addNested, options, usedFields, isRoot }) {
  const rows = node.children.map((child, i) => {
    // A nested group's first row uses the PARENT's AND connector (shown one level
    // up), so it drops its own "Where" and connector column — its dropdowns then
    // line up with the top-level row instead of being pushed right.
    const firstInNested = !isRoot && i === 0;
    return (
      <div key={child.id} style={child.type === 'group' ? g.rowTop : g.row}>
        {!firstInNested && <Connector i={i} conj={node.conj} onConj={(v) => setNode(node.id, (n) => ({ ...n, conj: v }))} />}
        {child.type === 'group'
          ? <FilterGroup node={child} setNode={setNode} removeNode={removeNode} onValue={onValue} addRule={addRule} addNested={addNested} options={options} usedFields={usedFields} isRoot={false} />
          : <RuleCols rule={child} setNode={setNode} onValue={onValue} onRemove={() => removeNode(child.id)} options={options} usedFields={usedFields} />}
      </div>
    );
  });
  const nestedLink = (
    <div style={isRoot ? g.nestedLinkRow : g.nestedLinkFlush}>
      <button type="button" style={g.linkBtn} onClick={() => addNested(node.id)}>Add nested filter</button>
    </div>
  );
  // A card (isRoot) = one panel with its rows + an "Add nested filter" link to add
  // AND rows within the card. New CARDS are created by the page-level "+ Add filter".
  if (isRoot) return <div style={g.panel}>{rows}{nestedLink}</div>;
  // Nested groups show ONLY their aligned row(s) — deleting the row prunes the group.
  return <div style={g.nested}>{rows}</div>;
}

/* ------------------------------------------------------------------ rule cols */
function RuleCols({ rule, setNode, onValue, onRemove, options, usedFields }) {
  const set = (patch) => setNode(rule.id, (n) => ({ ...n, ...patch }));
  const setVal = (v) => onValue(rule.id, rule.field, v); // cascades Space→List/Status, List→Status
  const cfDefs = options.customFields || [];
  // Built-in fields + the chosen Space's custom fields; hide fields already used in the card.
  const allFields = [...FIELDS.map((f) => ({ value: f.key, label: f.label })),
    ...cfDefs.map((c) => ({ value: c.key, label: c.label }))];
  const fieldOpts = allFields.filter((f) => f.value === rule.field || !usedFields?.has(f.value));
  // Empty value for a field: text/single = ''; everything multi = [].
  const emptyFor = (v) => {
    if (v.startsWith('cf:')) return (cfDefs.find((c) => c.key === v)?.type === 'text') ? '' : [];
    return emptyValue(v);
  };
  return (
    <>
      <div style={g.fieldCol}>
        <Select value={rule.field} onChange={(v) => set({ field: v, value: emptyFor(v) })}
          options={fieldOpts} />
      </div>
      <div style={g.opCol}>
        <Select value={rule.op} onChange={(v) => set({ op: v })} options={OPS} />
      </div>
      <div style={g.valCol}>
        <ValueEditor rule={rule} setVal={setVal} options={options} />
      </div>
      <button type="button" style={g.trash} onClick={onRemove} title="Remove"><IconTrash size={16} /></button>
    </>
  );
}

function ValueEditor({ rule, setVal, options }) {
  const active = ruleActive(rule); // a set value gets a highlighted control
  const arr = Array.isArray(rule.value) ? rule.value : [];
  // --- Custom field value editors (dropdown / text / relationship) ---
  if (rule.field.startsWith('cf:')) {
    const cf = (options.customFields || []).find((c) => c.key === rule.field);
    if (!cf) return <Select placeholder="Select option" value="" onChange={() => {}} options={[]} disabled />;
    if (cf.type === 'text')
      return <TextFilter value={rule.value} onChange={setVal} active={active} />;
    if (cf.type === 'dropdown') {
      const opts = (cf.config?.options || []).map((o) => ({ value: o.label, label: o.label }));
      return <MultiSelect active={active} value={arr} onChange={setVal} options={opts} placeholder="Select options" />;
    }
    // relationship: pick from the tasks in the related List (fall back to all loaded tasks)
    const relList = cf.config?.related_to === 'list' && cf.config?.list_id ? String(cf.config.list_id) : null;
    const opts = (options.tasks || [])
      .filter((t) => !relList || String(t.list_id) === relList)
      .slice(0, 300)
      .map((t) => ({ value: t._id, label: `${t.key ? t.key + ' · ' : ''}${t.title || ''}` }));
    return <MultiSelect active={active} value={arr} onChange={setVal} options={opts} placeholder="Select tasks" />;
  }
  if (rule.field === 'space')
    return <Select placeholder="Select option" highlight={active} value={rule.value} onChange={setVal}
      options={options.projects.map((p) => ({ value: p._id, label: p.name || p.key }))} />;
  if (rule.field === 'type')
    return <MultiSelect active={active} value={arr} onChange={setVal} options={TASK_TYPES} placeholder="Select types" />;
  if (rule.field === 'status')
    return <MultiSelect active={active} value={arr} onChange={setVal} options={options.statuses} placeholder="Select statuses" />;
  if (rule.field === 'list')
    return <MultiSelect active={active} value={arr} onChange={setVal} options={options.lists} placeholder="Select lists" />;
  // assignee / reporter — multi-select people
  return <UserPicker active={active} value={arr} onChange={setVal} users={options.users}
    myId={options.myId} allowUnassigned={rule.field === 'assignee'} />;
}

// Free-text value editor for a text custom field (matches "contains").
function TextFilter({ value, onChange, active }) {
  return (
    <input value={value || ''} placeholder="Contains text…" onChange={(e) => onChange(e.target.value)}
      style={{ ...g.trigger, ...(active ? g.triggerActive : {}), cursor: 'text' }} />
  );
}

/* --------------------------------------------------------------- MultiSelect */
function MultiSelect({ value, onChange, options, placeholder, active }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [open]);
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const label = value.length === 0 ? placeholder : value.length === 1
    ? (options.find((o) => o.value === value[0])?.label || '1 selected') : `${value.length} selected`;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="wg-select-trigger" style={{ ...g.trigger, ...(active ? g.triggerActive : {}) }} onClick={() => setOpen((o) => !o)}>
        <span style={{ color: value.length ? 'var(--c-text)' : 'var(--c-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <IconChevronDown size={14} />
      </button>
      {open && (
        <div style={g.pop}>
          {options.length === 0 && <div style={g.popEmpty}>No lists</div>}
          {options.map((o) => (
            <button key={o.value} type="button" style={g.popItem} onClick={() => toggle(o.value)}>
              <span style={{ ...g.checkbox, ...(value.includes(o.value) ? g.checkboxOn : {}) }}>{value.includes(o.value) ? '✓' : ''}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------- UserPicker (multi-select) */
function UserPicker({ value, onChange, users, myId, allowUnassigned, active }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const sel = Array.isArray(value) ? value : (value ? [value] : []);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [open]);
  const nameOf = (id) => users.find((u) => String(u.user_id) === String(id))?.full_name
    || users.find((u) => String(u.user_id) === String(id))?.email || 'User';
  const labelOf = (v) => (v === '__unassigned__' ? 'Unassigned' : v === '__me__' ? 'Me' : nameOf(v));
  const label = sel.length === 0 ? 'Select assignee' : sel.length === 1 ? labelOf(sel[0]) : `${sel.length} selected`;
  const filtered = users.filter((u) => !q.trim()
    || (u.full_name || '').toLowerCase().includes(q.trim().toLowerCase())
    || (u.email || '').toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (v) => onChange(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]);
  const Box = ({ on }) => <span style={{ ...g.checkbox, ...(on ? g.checkboxOn : {}) }}>{on ? '✓' : ''}</span>;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="wg-select-trigger" style={{ ...g.trigger, ...(active ? g.triggerActive : {}) }} onClick={() => setOpen((o) => !o)}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: sel.length ? 'var(--c-text)' : 'var(--c-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <IconUser size={14} />{label}
        </span>
        <IconChevronDown size={14} />
      </button>
      {open && (
        <div style={g.pop}>
          <div style={g.searchRow}>
            <IconSearch size={14} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or enter email…" style={g.searchInput} />
          </div>
          {allowUnassigned && <button type="button" style={g.popItem} onClick={() => toggle('__unassigned__')}><Box on={sel.includes('__unassigned__')} /><span style={g.avatarMuted}><IconUser size={13} /></span>Unassigned</button>}
          <button type="button" style={g.popItem} onClick={() => toggle('__me__')}><Box on={sel.includes('__me__')} /><span style={g.avatarMe}>{(nameOf(myId)[0] || 'M').toUpperCase()}</span>Me</button>
          {filtered.map((u) => (
            <button key={u.user_id} type="button" style={g.popItem} onClick={() => toggle(u.user_id)}>
              <Box on={sel.includes(u.user_id)} />
              <span style={g.avatarMe}>{((u.full_name || u.email || '?')[0] || '?').toUpperCase()}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name || u.email}</span>
            </button>
          ))}
          {filtered.length === 0 && <div style={g.popEmpty}>No people found</div>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------ Saved filters (DB-backed) */
// Sync which saved filter is "active" (by id) so the sidebar can highlight it.
const markActiveFilter = (id) => { try { localStorage.setItem('wg_active_filter', id); } catch { /* ignore */ } window.dispatchEvent(new Event('wg-active-filter-changed')); };
function SavedFilters({ cards, conj }) {
  const promptDialog = usePrompt();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState([]);
  const ref = useRef(null);
  const load = () => savedFiltersApi.list().then(setSaved).catch(() => setSaved([]));
  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener('wg-saved-filters-changed', onChange);
    return () => window.removeEventListener('wg-saved-filters-changed', onChange);
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    load();
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [open]);
  const save = async () => {
    const name = await promptDialog({ title: 'Save filter', message: 'Give this filter a name.', placeholder: 'Filter name', confirmLabel: 'Save' });
    if (!name || !name.trim()) return;
    try {
      const created = await savedFiltersApi.create({ name: name.trim(), cards, conj });
      window.dispatchEvent(new Event('wg-saved-filters-changed'));
      navigate(`/filters/${created.id}`); // give the new filter its own route
    } catch { /* ignore */ }
  };
  const del = async (id) => {
    try { await savedFiltersApi.remove(id); } catch { /* ignore */ }
    window.dispatchEvent(new Event('wg-saved-filters-changed'));
    load();
  };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="btn" style={g.savedBtn} onClick={() => setOpen((o) => !o)}>
        Saved filters <IconChevronDown size={14} />
      </button>
      {open && (
        <div style={{ ...g.pop, right: 0, left: 'auto', minWidth: 220 }}>
          <button type="button" style={g.popItem} onClick={() => { save(); setOpen(false); }}><IconPlus size={14} /> Save current filter</button>
          {saved.length > 0 && <div style={g.popDivider} />}
          {saved.map((sf) => (
            <div key={sf.id} style={g.savedRow}>
              <button type="button" style={{ ...g.popItem, flex: 1 }} onClick={() => { navigate(`/filters/${sf.id}`); setOpen(false); }}>{sf.name}</button>
              <button type="button" style={g.trash} onClick={() => del(sf.id)} title="Delete"><IconTrash size={14} /></button>
            </div>
          ))}
          {saved.length === 0 && <div style={g.popEmpty}>No saved filters yet</div>}
        </div>
      )}
    </div>
  );
}

const Th = ({ children, w }) => <th style={{ ...s.th, width: w }}>{children}</th>;
const Td = ({ children }) => <td style={s.td}>{children}</td>;

/* --------------------------------------------------------------------- styles */
const g = {
  // ClickUp-style: all rows live in ONE light rounded panel; nesting is shown by
  // an indented left-accent block that shares the same panel background.
  panel: { background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  nested: { flex: 1, display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  rowTop: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  connCol: { width: 84, flexShrink: 0, minHeight: 38, display: 'flex', alignItems: 'center' },
  where: { fontSize: 13, color: 'var(--c-muted)', paddingLeft: 6 },
  conjText: { fontSize: 13, fontWeight: 700, color: 'var(--c-muted)', paddingLeft: 6 },
  fieldCol: { width: 172, flexShrink: 0 },
  opCol: { width: 104, flexShrink: 0 },
  valCol: { flex: 1, minWidth: 160 },
  trash: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 38, border: 'none',
    background: 'none', color: 'var(--c-muted)', cursor: 'pointer', borderRadius: 8, flexShrink: 0 },
  nestedLinkRow: { paddingLeft: 92 },
  nestedLinkFlush: { paddingLeft: 0 },
  linkBtn: { background: 'none', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 13, padding: '2px 4px' },
  footer: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 },
  triggerActive: { borderColor: 'var(--c-primary)', boxShadow: '0 0 0 2px var(--c-primary-weak)' },
  addFilter: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600 },
  removeGroup: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: '1px solid var(--c-border)',
    background: 'var(--c-surface)', color: 'var(--c-muted)', cursor: 'pointer', borderRadius: 8 },
  savedBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5 },
  trigger: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', height: 38,
    padding: '0 12px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8,
    cursor: 'pointer', fontSize: 14, color: 'var(--c-text)' },
  pop: { position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 40, minWidth: 240, maxWidth: 320, maxHeight: 280, overflowY: 'auto',
    background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, boxShadow: '0 12px 32px rgba(16,24,40,.16)', padding: 6 },
  popItem: { display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', background: 'none', border: 'none',
    padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: 'var(--c-text)' },
  popEmpty: { padding: '10px 12px', fontSize: 13, color: 'var(--c-muted)' },
  popDivider: { height: 1, background: 'var(--c-border)', margin: '4px 0' },
  checkbox: { width: 18, height: 18, borderRadius: 5, border: '1px solid var(--c-border)', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 12, color: '#fff', flexShrink: 0 },
  checkboxOn: { background: 'var(--c-primary)', borderColor: 'var(--c-primary)' },
  searchRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 8px', color: 'var(--c-faint)', borderBottom: '1px solid var(--c-border)', marginBottom: 4 },
  searchInput: { flex: 1, border: 'none', outline: 'none', background: 'none', fontSize: 14, color: 'var(--c-text)' },
  savedRow: { display: 'flex', alignItems: 'center' },
  avatarMuted: { width: 22, height: 22, borderRadius: '50%', background: 'var(--c-surface-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-muted)', flexShrink: 0 },
  avatarMe: { width: 22, height: 22, borderRadius: '50%', background: 'var(--c-primary)', color: 'var(--c-on-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 },
};

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: 22, color: 'var(--c-text-strong)' },
  titleIcon: { display: 'inline-flex', color: 'var(--c-muted)' },
  builder: { padding: 16, marginBottom: 16 },
  builderHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  builderTitle: { fontSize: 15, fontWeight: 700, color: 'var(--c-text-strong)' },
  cardBlock: { marginBottom: 10 },
  cardDivider: { display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' },
  cardDividerText: { fontSize: 12, fontWeight: 700, letterSpacing: '.03em', color: 'var(--c-muted)', paddingLeft: 8 },
  builderFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  clearAllBtn: { fontSize: 13.5, color: 'var(--c-muted)' },
  info: { color: 'var(--c-faint)', fontSize: 13, cursor: 'help' },
  results: { padding: 0, overflow: 'visible' },
  resultsHead: { padding: '12px 16px', fontSize: 13, color: 'var(--c-muted)', borderBottom: '1px solid var(--c-border)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 16px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--c-muted)', background: 'var(--c-surface-2)' },
  td: { padding: '11px 16px', fontSize: 14, color: 'var(--c-text)', verticalAlign: 'middle' },
  row: { borderTop: '1px solid var(--c-border-2)', cursor: 'pointer' },
  key: { color: 'var(--c-primary)', fontWeight: 700, fontSize: 13 },
  name: { color: 'var(--c-text-strong)' },
  muted: { color: 'var(--c-muted)', fontSize: 13 },
  chip: { display: 'inline-block', padding: '2px 10px', border: '1px solid', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'transparent' },
  empty: { padding: 28, textAlign: 'center', color: 'var(--c-muted)' },
};
