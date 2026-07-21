import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useHeaderSlot } from '../../layouts/headerSlot';
import { tasksApi, resolveStatuses, statusLabel, statusColor, PRIORITY_COLOR } from '../tasks/tasksApi';
import { projectsApi } from '../projects/projectsApi';
import { listsApi } from '../lists/listsApi';
import { dashboardsApi } from '../dashboard/dashboardsApi';
import { customFieldsApi } from '../customfields/customFieldsApi';
import { savedFiltersApi } from './savedFiltersApi';
import { labelsApi } from '../labels/labelsApi';
import { useAuth } from '../auth/useAuth';
import { usePrompt } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import Select from '../../components/Select';
import { IconTrash, IconPlus, IconChevronDown, IconSearch, IconUser, IconEdit, IconMembers, IconBoard, IconFilter, IconListCheck } from '../../components/icons';
import { useConfirm } from '../../components/ConfirmDialog';
import FilterShareModal from './FilterShareModal';
import ResizableTable from '../../components/ResizableTable';

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
  { key: 'label', label: 'Label' },
];
// Every field except Space is multi-select (value = array); Space stays a single id.
const MULTI_FIELDS = new Set(['list', 'type', 'status', 'assignee', 'reporter', 'label']);
const emptyValue = (field) => (MULTI_FIELDS.has(field) ? [] : '');
let _seq = 0;
// Collision-proof node id: a session counter PLUS a random suffix, so freshly
// added rules never share an id with the sequential ids (n0, n1…) baked into a
// previously-saved filter — which was causing edits/deletes to hit two nodes.
const nid = () => `n${_seq++}_${Math.random().toString(36).slice(2, 9)}`;
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

// Merge `next` into `prev` by `key`, keeping existing entries (union, no duplicates).
const unionById = (prev, next, key) => {
  const seen = new Set((prev || []).map((x) => String(x[key])));
  const add = (next || []).filter((x) => !seen.has(String(x[key])));
  return add.length ? [...(prev || []), ...add] : (prev || []);
};
// Structural signature of the EFFECTIVE (active) rule tree — ignores node ids AND any
// rule without a value, exactly like the server evaluator. So adding or editing an
// empty rule (e.g. picking the Status field before choosing a value) produces the same
// signature and does NOT trigger a re-evaluate; only setting a value changes the results.
const ruleSig = (cards, conj) => {
  const norm = (n) => (n.type === 'group'
    ? { t: 'g', c: n.conj, ch: (n.children || []).filter(nodeActive).map(norm) }
    : { t: 'r', f: n.field, o: n.op, v: n.value });
  return JSON.stringify({ conj, cards: (cards || []).filter(nodeActive).map(norm) });
};

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
// Deep-clone a loaded tree with fresh unique ids — heals any duplicate ids saved
// by the old (colliding) id generator so edits/deletes only ever hit one node.
const reId = (node) => (node.type === 'group'
  ? { ...node, id: nid(), children: (node.children || []).map(reId) }
  : { ...node, id: nid() });

// Result-table columns (defaults; widths/visibility persisted in localStorage).
const COLS_LS = 'wg_filter_cols';
const COL_DEFS = [
  { key: 'key', label: 'Key', width: 96, min: 64 },
  { key: 'title', label: 'Title', width: 340, min: 140 },
  { key: 'space', label: 'Space', width: 160, min: 90 },
  { key: 'status', label: 'Status', width: 140, min: 100 },
  { key: 'assignee', label: 'Assignee', width: 150, min: 90 },
  { key: 'due', label: 'Due date', width: 110, min: 80 },
  { key: 'priority', label: 'Priority', width: 110, min: 80 },
];

export default function FiltersPage() {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const slotEl = useHeaderSlot();
  const { user, can } = useAuth();
  const myId = user?._id || user?.id || '';
  const canAddMembers = can('filter.member.add');
  const [filterName, setFilterName] = useState(''); // saved filter's name (for the header breadcrumb)
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [tab, setTab] = useState('filters');   // filters | members
  const [mShare, setMShare] = useState(false);  // Add-people modal
  const [mReload, setMReload] = useState(0);    // bump to refresh members table
  const [showBuilder, setShowBuilder] = useState(false); // filter builder card hidden by default
  const toast = useToast();

  // Result-table column widths + visibility (persisted in localStorage).
  const [colState, setColState] = useState(() => {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(COLS_LS) || '{}'); } catch { /* ignore */ }
    const widths = {}, visible = {};
    COL_DEFS.forEach((c) => { widths[c.key] = saved.widths?.[c.key] || c.width; visible[c.key] = saved.visible?.[c.key] !== false; });
    return { widths, visible };
  });
  const persistCols = (st) => { try { localStorage.setItem(COLS_LS, JSON.stringify(st)); } catch { /* ignore */ } };
  const toggleColumn = (key) => setColState((st) => {
    const visible = { ...st.visible, [key]: !st.visible[key] };
    if (!Object.values(visible).some(Boolean)) return st; // keep at least one column
    const next = { ...st, visible }; persistCols(next); return next;
  });
  const startColResize = (e, key) => {
    e.preventDefault(); e.stopPropagation();
    const col = COL_DEFS.find((c) => c.key === key);
    const startX = e.clientX; const startW = colState.widths[key];
    const move = (ev) => setColState((st) => ({ ...st, widths: { ...st.widths, [key]: Math.max(col.min || 60, startW + (ev.clientX - startX)) } }));
    const up = () => {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      document.body.style.userSelect = '';
      setColState((st) => { persistCols(st); return st; });
    };
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  };
  const [projects, setProjects] = useState([]);
  const [lists, setLists] = useState([]);     // {_id, name, spaceId, spaceName}
  const [users, setUsers] = useState([]);     // {user_id, full_name, email}
  const [labels, setLabels] = useState([]);   // global label catalog {id, name, color}
  const [tasks, setTasks] = useState([]);       // the CURRENT PAGE of matched tasks (server-paginated)
  const [total, setTotal] = useState(0);        // grand total of matched tasks (for the pager)
  const [page, setPage] = useState(0);          // 0-based current page
  const [pageSize, setPageSize] = useState(10); // rows per page
  const [allTasks, setAllTasks] = useState([]); // full task set — only the builder's relationship picker needs it
  const [loading, setLoading] = useState(false);
  // Each "card" is an independent filter group; the bottom "+ Add filter" adds a card.
  const [cards, setCards] = useState(() => [newGroup()]);
  const [cardsConj, setCardsConj] = useState('AND'); // AND / OR join BETWEEN cards

  // --- Lazy loaders for the BUILDER's option dropdowns. Results no longer need these —
  // the server evaluate/results call bundles the reference data for the table — so each
  // loads at most once, only when its dropdown is opened. ---
  const loadedRef = useRef({ spaces: false, users: false, labels: false, tasks: false });
  const ensureSpaces = useCallback(async () => {
    if (loadedRef.current.spaces) return;
    loadedRef.current.spaces = true;
    const ps = (await projectsApi.list({ limit: 200 }).catch(() => ({ items: [] }))).items || [];
    setProjects((prev) => unionById(prev, ps, '_id'));
    const perSpace = await Promise.all(ps.map((p) =>
      listsApi.forSpace(p._id).then((ls) => (ls || []).map((l) => ({ ...l, spaceId: p._id, spaceName: p.name || p.key }))).catch(() => [])));
    setLists((prev) => unionById(prev, perSpace.flat(), '_id'));
  }, []);
  const ensureUsers = useCallback(async () => {
    if (loadedRef.current.users) return;
    loadedRef.current.users = true;
    dashboardsApi.searchUsers('')
      .then((u) => setUsers((prev) => unionById(prev, Array.isArray(u) ? u : (u?.items || []), 'user_id')))
      .catch(() => {});
  }, []);
  const ensureLabels = useCallback(async () => {
    if (loadedRef.current.labels) return;
    loadedRef.current.labels = true;
    labelsApi.list().then(setLabels).catch(() => setLabels([]));
  }, []);
  const ensureTasks = useCallback(async () => {
    if (loadedRef.current.tasks) return;
    loadedRef.current.tasks = true;
    const PAGE = 200, CAP = 2000; const all = [];
    for (let skip = 0; skip < CAP; skip += PAGE) {
      const r = await tasksApi.list({ limit: PAGE, skip }).catch(() => ({ items: [], total: 0 }));
      const items = r.items || []; all.push(...items);
      if (items.length < PAGE || all.length >= (r.total || 0)) break;
    }
    setAllTasks(all);
  }, []);

  // Absorb one page of server results: the page rows + total, plus the reference data
  // (union so the builder's fuller sets, when later loaded, aren't clobbered).
  const absorbRefs = useCallback((res) => {
    setTasks(res.items || []);
    setTotal(res.total || 0);
    if (res.spaces) setProjects((p) => unionById(p, res.spaces, '_id'));
    if (res.lists) setLists((p) => unionById(p, res.lists, '_id'));
    if (res.users) setUsers((p) => unionById(p, res.users, 'user_id'));
  }, []);

  // Route-driven: /filters/:id loads that saved filter AND its results in ONE call;
  // /filters/new is a fresh builder. `lastSigRef` marks the rule tree we already have
  // results for, so the live-evaluate effect below doesn't re-fetch the same thing.
  const lastSigRef = useRef(null);
  // Snapshot of the last-SAVED filter tree, so Cancel can discard unsaved edits.
  const savedSnapRef = useRef({ cards: [], conj: 'AND' });
  useEffect(() => {
    setPage(0); // new route → first page
    if (routeId && routeId !== 'new') {
      setLoading(true);
      savedFiltersApi.results(routeId, { skip: 0, limit: pageSize }).then((res) => {
        const rc = res.filter?.cards?.length ? res.filter.cards.map(reId) : [newGroup()];
        setCards(rc);
        setCardsConj(res.filter?.conj || 'AND');
        setFilterName(res.filter?.name || '');
        savedSnapRef.current = { cards: res.filter?.cards || [], conj: res.filter?.conj || 'AND' };
        lastSigRef.current = `${ruleSig(rc, res.filter?.conj || 'AND')}|0|${pageSize}`;
        absorbRefs(res);
        markActiveFilter(routeId);
      }).catch(() => { navigate('/filters', { replace: true }); })
        .finally(() => setLoading(false));
    } else {
      setCards([newGroup()]);
      setCardsConj('AND');
      setFilterName('');
      setTasks([]);
      setTotal(0);
      savedSnapRef.current = { cards: [], conj: 'AND' };
      lastSigRef.current = null;
      markActiveFilter('');
    }
    setTab('filters');
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
  // Builder-only (never shown in the results table), so skip the fetch when the builder
  // isn't visible (e.g. a saved filter whose builder is collapsed).
  const [customFields, setCustomFields] = useState([]);
  const [cfWanted, setCfWanted] = useState(false); // set once the user opens the field picker
  const builderShown = !routeId || routeId === 'new' || showBuilder;
  // Custom fields are only needed to (a) render an existing cf rule or (b) offer cf
  // options in the field picker once it's opened — NOT just to view Space/List rules.
  // So don't fetch them merely because the builder opened on a saved filter.
  const hasCfRule = useMemo(() => {
    let found = false;
    const scan = (n) => { if (found) return; if (n.type === 'group') n.children.forEach(scan); else if (String(n.field).startsWith('cf:')) found = true; };
    cards.forEach(scan);
    return found;
  }, [cards]);
  useEffect(() => {
    if (!builderShown || !contextSpaceId || !(hasCfRule || cfWanted)) { setCustomFields([]); return; }
    customFieldsApi.list(contextSpaceId, contextListId || undefined, undefined, { _silent: true })
      .then((fs) => setCustomFields((fs || [])
        .filter((f) => ['dropdown', 'text', 'relationship'].includes(f.type))
        .map((f) => ({ key: `cf:${f._id}`, id: f._id, label: f.name, type: f.type, config: f.config || {}, location: f.location }))))
      .catch(() => setCustomFields([]));
  }, [contextSpaceId, contextListId, builderShown, hasCfRule, cfWanted]);

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
    // Group the statuses BY LIST (each list can have its own custom workflow), so the
    // dropdown shows e.g. "DEVELOPMENT → its statuses, EPIC → its statuses, …" with
    // EVERY status listed under each list. Option values are namespaced `${listId}::${key}`
    // so the SAME status key living in two lists stays independently selectable — ticking
    // DEVELOPMENT's status must NOT tick EPIC's copy. The status eval below understands
    // this `list::key` form (it matches the task's list AND status).
    const grouped = (srcLists) => srcLists.flatMap((l) =>
      listStatuses(l).map((st) => ({ value: `${l._id}::${st.key}`, label: st.name, group: l.name })));
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
      if (spaceLists.length) spaceLists.forEach((l) => add(listStatuses(l)));
      else add(stsBySpace[p._id] || []);
      return out;
    });
  }, [cards, lists, contextSpaceId, stsBySpace, projects]);

  const listOptions = useMemo(() => {
    // A Space is chosen → just its Lists (flat). Otherwise group the Lists BY SPACE
    // (space name as the header) so the dropdown reads "Opbook360AI → its lists, …".
    if (contextSpaceId) {
      return lists.filter((l) => String(l.spaceId) === contextSpaceId).map((l) => ({ value: l._id, label: l.name }));
    }
    return [...lists]
      .sort((a, b) => (a.spaceName || '').localeCompare(b.spaceName || '') || (a.name || '').localeCompare(b.name || ''))
      .map((l) => ({ value: l._id, label: l.name, group: l.spaceName }));
  }, [contextSpaceId, lists]);
  const userName = (id) => users.find((u) => String(u.user_id) === String(id))?.full_name || users.find((u) => String(u.user_id) === String(id))?.email || '—';
  const spaceName = (id) => projects.find((p) => String(p._id) === String(id))?.name || projects.find((p) => String(p._id) === String(id))?.key || '—';


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

  // Cancel: discard unsaved edits. For a saved filter, restore the last-saved rule tree
  // (with fresh ids) and close the builder; for a new filter, leave the page.
  const cancelBuilder = () => {
    if (isSaved) {
      const snap = savedSnapRef.current;
      setCards(snap.cards?.length ? snap.cards.map(reId) : [newGroup()]);
      setCardsConj(snap.conj || 'AND');
      setShowBuilder(false);
    } else {
      navigate('/filters');
    }
  };

  // Inline rename of the saved filter from the header breadcrumb.
  const isSaved = routeId && routeId !== 'new';
  const startRename = () => { setNameDraft(filterName || ''); setEditingName(true); };
  const commitName = async () => {
    const v = (nameDraft || '').trim();
    setEditingName(false);
    if (!v || v === filterName || !isSaved) return;
    setFilterName(v);
    try { await savedFiltersApi.update(routeId, { name: v }); toast.success('Filter renamed'); window.dispatchEvent(new Event('wg-saved-filters-changed')); }
    catch { toast.error('Could not rename filter'); }
  };

  const options = { projects, lists: listOptions, statuses: statusOptions, users, myId, customFields, tasks: allTasks,
    labels: labels.map((l) => ({ value: l.name, label: l.name })),
    ensureSpaces, ensureUsers, ensureLabels, ensureTasks, onNeedFields: () => setCfWanted(true) };

  // Active rule count (for the "Filter" toggle badge).
  const activeCount = useMemo(() => {
    let n = 0;
    const scan = (node) => { if (node.type === 'group') node.children.forEach(scan); else if (ruleActive(node)) n += 1; };
    cards.forEach(scan);
    return n;
  }, [cards]);

  // Reset to the first page whenever the filter rules change (so a new filter's results
  // start at page 1, not a stale page index).
  const treeSig = useMemo(() => ruleSig(cards, cardsConj), [cards, cardsConj]);
  useEffect(() => { setPage(0); }, [treeSig]);

  // Live server-side results: fetch the CURRENT PAGE whenever the rule tree OR the page/
  // size changes. Debounced. Skipped when we already have exactly this page (e.g. right
  // after the saved-filter results() load), so a saved-filter view stays one request per page.
  useEffect(() => {
    if (activeCount === 0) { setTasks([]); setTotal(0); lastSigRef.current = null; return undefined; }
    const sig = `${treeSig}|${page}|${pageSize}`;
    if (sig === lastSigRef.current) return undefined;
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      savedFiltersApi.evaluate(cards, cardsConj, { skip: page * pageSize, limit: pageSize })
        .then((res) => { if (alive) { lastSigRef.current = sig; absorbRefs(res); } })
        .catch(() => { if (alive) { setTasks([]); setTotal(0); } })
        .finally(() => { if (alive) setLoading(false); });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [activeCount, treeSig, cards, cardsConj, page, pageSize, absorbRefs]);

  // Result table columns — defaults from COL_DEFS, cell renderers close over helpers.
  const shortDate = (d) => (d ? new Date(`${d}T00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—');
  const RENDERERS = {
    key: (t) => <span style={s.key}>{t.key}</span>,
    title: (t) => <OverflowText text={t.title} style={s.name} />,
    space: (t) => <OverflowText text={spaceName(t.project_id)} style={s.muted} />,
    status: (t) => { const sts = stsForTask(t); return <span style={{ ...s.chip, color: statusColor(sts, t.status), borderColor: statusColor(sts, t.status) }}>{statusLabel(sts, t.status)}</span>; },
    assignee: (t) => <OverflowText text={t.assignee_id ? userName(t.assignee_id) : 'Unassigned'} style={s.muted} />,
    due: (t) => <span style={s.muted}>{shortDate(t.end_date || t.due_date)}</span>,
    priority: (t) => <span style={{ color: PRIORITY_COLOR[t.priority] || 'var(--c-muted)', fontWeight: 600, textTransform: 'capitalize' }}>{t.priority || '—'}</span>,
  };
  const columns = COL_DEFS.map((c) => ({ ...c, render: RENDERERS[c.key] }));

  // The filter builder card (shown inside the View tab only when "Filter" is toggled on).
  const builderCard = (
    <div style={s.builder}>
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
        <div style={s.footerRight}>
          <button type="button" className="btn" style={s.cancelBtn}
            onClick={cancelBuilder}>Cancel</button>
          <button type="button" className="btn" style={s.clearAllBtn} onClick={clearAll}>Clear all</button>
          <SaveFilterButton cards={cards} conj={cardsConj} routeId={routeId}
            onSaved={() => { savedSnapRef.current = { cards, conj: cardsConj }; }} />
        </div>
      </div>
    </div>
  );

  const filterToggle = (
    <button type="button" className="btn" style={{ ...s.filterToggle, ...(showBuilder ? s.filterToggleActive : {}) }}
      onClick={() => setShowBuilder((v) => !v)}>
      <IconFilter size={15} /> Filter
      {activeCount > 0 && <span style={s.filterBadge}>{activeCount}</span>}
      <span style={{ display: 'inline-flex', transform: showBuilder ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><IconChevronDown size={13} /></span>
    </button>
  );

  return (
    <div style={s.page}>
      {/* Breadcrumb ("Filters › <saved filter name>") lives in the shared topbar. */}
      {slotEl && createPortal(
        <span style={s.crumbs}>
          <button style={s.crumbLink} onClick={() => navigate('/filters')}>Filters</button>
          <span style={s.crumbSep}>›</span>
          {editingName ? (
            <input style={s.crumbInput} value={nameDraft} autoFocus
              onChange={(e) => setNameDraft(e.target.value)} onBlur={commitName}
              onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }} />
          ) : (
            <span style={s.crumbCurrentWrap}>
              <span style={s.crumbCurrent}>{filterName || 'New filter'}</span>
              {isSaved && (
                <button className="icon-btn" style={s.crumbEdit} title="Rename filter" onClick={startRename}><IconEdit size={14} /></button>
              )}
            </span>
          )}
        </span>,
        slotEl,
      )}

      {/* Tabs (Filters · Members) — like the dashboard detail. Members only exist
          once the filter is saved (it needs an id to share). */}
      {isSaved && (
        <div style={s.tabs}>
          <div style={s.tabsLeft}>
            <button style={{ ...s.tab, ...(tab === 'filters' ? s.tabActive : {}) }} onClick={() => setTab('filters')}>
              <IconBoard size={15} /> View
            </button>
            <button style={{ ...s.tab, ...(tab === 'members' ? s.tabActive : {}) }} onClick={() => setTab('members')}>
              <IconMembers size={15} /> Members
            </button>
          </div>
          {/* Right corner: Add people on Members, Filter + count + Columns on View. */}
          {tab === 'members' ? (
            <button style={{ ...s.addBtn, ...(canAddMembers ? {} : { opacity: 0.5, cursor: 'not-allowed' }) }}
              onClick={() => (canAddMembers ? setMShare(true) : toast.error("You don't have permission to add members"))}><IconPlus size={16} /> Add people</button>
          ) : (
            <div style={s.tabsRight}>
              {filterToggle}
              <ColumnsMenu columns={columns} colState={colState} onToggle={toggleColumn} />
            </div>
          )}
        </div>
      )}

      {isSaved && tab === 'members' ? (
        <FilterMembers filterId={routeId} reloadKey={mReload} />
      ) : isSaved ? (
        // Saved filter View tab: builder (when toggled) then the results table.
        <div style={s.viewArea}>
          {showBuilder && builderCard}
          {/* Only show tasks once a filter is actually applied; otherwise the empty
              "No tasks found" state (avoids dumping every task with no filter). */}
          <ResultsTable columns={columns} rows={activeCount > 0 ? tasks : []} total={activeCount > 0 ? total : 0}
            page={page} pageSize={pageSize} onPageChange={setPage}
            onPageSizeChange={(n) => { setPageSize(n); setPage(0); }} loading={loading}
            colState={colState} onResizeStart={startColResize}
            onOpenTask={(id) => navigate(`/tasks/${id}`)} />
        </div>
      ) : (
        // Brand-new (unsaved) filter: builder + a live results preview once a
        // filter rule is set (so you can see matches before saving).
        <div style={s.viewArea}>
          {builderCard}
          {activeCount > 0 && (
            <ResultsTable columns={columns} rows={tasks} total={total}
              page={page} pageSize={pageSize} onPageChange={setPage}
              onPageSizeChange={(n) => { setPageSize(n); setPage(0); }} loading={loading}
              colState={colState} onResizeStart={startColResize}
              onOpenTask={(id) => navigate(`/tasks/${id}`)} />
          )}
        </div>
      )}

      <FilterShareModal open={mShare} filterId={routeId}
        onClose={() => { setMShare(false); setMReload((x) => x + 1); }}
        onChanged={() => setMReload((x) => x + 1)} />
    </div>
  );
}

/* ------------------------------------------------------- Members tab (table) */
function FilterMembers({ filterId, reloadKey }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { can } = useAuth();
  const canRemove = can('filter.member.remove');
  const [members, setMembers] = useState([]);

  const load = () => savedFiltersApi.members(filterId).then((r) => setMembers(r.items || [])).catch(() => setMembers([]));
  useEffect(() => { load(); }, [filterId, reloadKey]); // eslint-disable-line

  const remove = async (m) => {
    if (m.is_owner) return;
    if (!(await confirm({ title: 'Remove member', message: `Remove ${m.full_name || m.email}?`, confirmLabel: 'Remove', danger: true }))) return;
    try { await savedFiltersApi.removeMember(filterId, m.user_id); load(); window.dispatchEvent(new Event('wg-saved-filters-changed')); }
    catch { toast.error('Could not remove member'); }
  };

  return (
    <ResizableTable persistKey="wg_filter_members_cols" rowKey={(m) => m.user_id} rows={members} emptyText="No members yet."
      columns={[
        { key: 'name', label: 'Name', width: 320, min: 140, render: (m) => <span style={s.mName}>{m.full_name || '—'}</span> },
        { key: 'email', label: 'Email', width: 320, min: 140, render: (m) => <span style={s.muted}>{m.email}</span> },
        { key: 'actions', label: 'Actions', width: 120, min: 90, align: 'right',
          render: (m) => (m.is_owner
            ? <span style={s.ownerTag}>Owner</span>
            : (canRemove
                ? <button className="wg-danger-link" style={s.removeLink} onClick={() => remove(m)}>Remove</button>
                : <span style={s.muted}>—</span>)) },
      ]} />
  );
}

/* ------------------------------- Columns show/hide menu (in the tab bar corner) */
function ColumnsMenu({ columns, colState, onToggle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="btn" style={s.colBtn} onClick={() => setOpen((o) => !o)}>
        <IconListCheck size={15} /> Columns <IconChevronDown size={13} />
      </button>
      {open && (
        <div style={s.colMenu} role="menu">
          {columns.map((c) => (
            <button key={c.key} type="button" className="wg-menu-item" style={s.colMenuItem} onClick={() => onToggle(c.key)}>
              <span style={{ ...s.colCheck, ...(colState.visible[c.key] ? s.colCheckOn : {}) }}>{colState.visible[c.key] ? '✓' : ''}</span>
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* Cell text that ellipsises and shows a tooltip with the full value ONLY when it's
   actually truncated. Measured at hover time; the tooltip is portaled so it can't clip. */
function OverflowText({ text, style }) {
  const ref = useRef(null);
  const [tip, setTip] = useState(null);
  const onEnter = () => {
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const r = el.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2, y: r.top });
  };
  return (
    <>
      <span ref={ref} onMouseEnter={onEnter} onMouseLeave={() => setTip(null)}
        style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...style }}>{text}</span>
      {tip && createPortal(
        <div style={{ position: 'fixed', left: tip.x, top: tip.y, transform: 'translate(-50%, -125%)', pointerEvents: 'none',
          background: 'var(--c-text-strong)', color: 'var(--c-surface)', padding: '6px 10px', borderRadius: 7, fontSize: 12.5,
          lineHeight: 1.35, maxWidth: 460, whiteSpace: 'normal', boxShadow: '0 4px 16px rgba(0,0,0,.24)', zIndex: 9999 }}>{text}</div>,
        document.body)}
    </>
  );
}

/* ---------------------------------------- Results table (resizable columns) */
const PAGE_SIZES = [10, 20, 50, 100];
function ResultsTable({ columns, rows, total, page, pageSize, onPageChange, onPageSizeChange, loading, colState, onResizeStart, onOpenTask }) {
  const navigate = useNavigate();
  const shown = columns.filter((c) => colState.visible[c.key]);
  // Server-side pagination: `rows` IS the current page; the parent refetches on page change.
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = rows;
  const from = total === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(total, safePage * pageSize + rows.length);

  // --- bulk selection --- (opens the step-by-step Bulk Operation page)
  const [selected, setSelected] = useState(() => new Set());
  const allIds = rows.map((r) => r._id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const toggleRow = (id) => setSelected((s2) => { const n = new Set(s2); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(() => (allSelected ? new Set() : new Set(allIds)));
  const clearSel = () => setSelected(new Set());
  const startBulk = () => {
    const picked = rows.filter((r) => selected.has(r._id));
    if (picked.length) navigate('/bulk-edit', { state: { tasks: picked } });
  };

  return (
    <div style={s.rCard}>
      {/* Bulk action bar — appears when tasks are selected */}
      {selected.size > 0 && (
        <div style={s.bulkBar}>
          <span style={s.bulkCount}>{selected.size} selected</span>
          <button type="button" className="btn btn-primary" style={s.bulkBtn} onClick={startBulk}>Bulk change work items</button>
          <button type="button" className="icon-btn" style={s.bulkClear} onClick={clearSel} title="Clear selection">✕</button>
        </div>
      )}
      <div style={s.rScroll}>
        <table style={s.rTable}>
          <colgroup><col style={{ width: 42 }} />{shown.map((c) => <col key={c.key} style={{ width: colState.widths[c.key] }} />)}</colgroup>
          <thead>
            <tr>
              <th style={{ ...s.rTh, ...s.rColLine, textAlign: 'center' }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} title="Select all" />
              </th>
              {shown.map((c, i) => (
                <th key={c.key} style={{ ...s.rTh, ...(i < shown.length - 1 ? s.rColLine : {}) }}>
                  <span style={s.rThLabel}>{c.label}</span>
                  {i < shown.length - 1 && <span style={s.rResize} onMouseDown={(e) => onResizeStart(e, c.key)} title="Drag to resize" />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && total === 0 && <tr><td colSpan={shown.length + 1} style={s.empty}>No tasks found</td></tr>}
            {pageRows.map((t) => (
              <tr key={t._id} className="wg-rel-row" style={{ ...s.rRow, ...(selected.has(t._id) ? { background: 'var(--c-hover)' } : {}) }} onClick={() => onOpenTask(t._id)}>
                <td style={{ ...s.rTd, ...s.rColLine, textAlign: 'center' }} onClick={(e) => { e.stopPropagation(); toggleRow(t._id); }}>
                  <input type="checkbox" checked={selected.has(t._id)} onChange={() => toggleRow(t._id)} onClick={(e) => e.stopPropagation()} />
                </td>
                {shown.map((c, i) => <td key={c.key} style={{ ...s.rTd, ...(i < shown.length - 1 ? s.rColLine : {}) }}><div style={s.rClip}>{c.render(t)}</div></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > 0 && (
        <div style={s.pager}>
          <label style={s.pagerLeft}>
            Rows per page:
            <Select value={pageSize} onChange={(v) => onPageSizeChange(Number(v))} style={s.pageSelect}
              options={PAGE_SIZES.map((n) => ({ value: n, label: String(n) }))} />
          </label>
          <div style={s.pagerRight}>
            <span style={s.pagerRange}>{from}–{to} of {total}</span>
            <button type="button" style={{ ...s.pagerBtn, ...(safePage === 0 ? s.pagerDisabled : {}) }}
              disabled={safePage === 0} onClick={() => onPageChange(safePage - 1)} title="Previous">‹</button>
            <span style={s.pagerPage}>{safePage + 1} / {pageCount}</span>
            <button type="button" style={{ ...s.pagerBtn, ...(safePage >= pageCount - 1 ? s.pagerDisabled : {}) }}
              disabled={safePage >= pageCount - 1} onClick={() => onPageChange(safePage + 1)} title="Next">›</button>
          </div>
        </div>
      )}
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
    case 'status': m = vals.some((v) => {
      // Values may be a bare status key, or `${listId}::${key}` (list-scoped, from
      // the per-list grouped dropdown). The latter must match BOTH the task's list
      // and its status so the same key in different lists filters independently.
      const sep = v.indexOf('::');
      if (sep === -1) return String(t.status) === v;
      return String(t.list_id) === v.slice(0, sep) && String(t.status) === v.slice(sep + 2);
    }); break;
    case 'assignee':
      m = vals.some((v) => v === '__unassigned__' ? !t.assignee_id
        : v === '__me__' ? String(t.assignee_id) === String(ctx.myId)
          : String(t.assignee_id) === v); break;
    case 'reporter':
      m = vals.some((v) => v === '__me__' ? String(t.reporter_id) === String(ctx.myId)
        : String(t.reporter_id) === v); break;
    case 'label': m = (t.labels || []).some((l) => vals.includes(String(l))); break;
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
  // A custom field's label carries WHERE it lives, so two same-named fields are
  // distinguishable — e.g. a list-scoped "epic" (location "EPIC") vs the inherited
  // space-level "epic" (location "Opbook360AI"). The backend's `location` already
  // encodes this (its owning List for list-scoped, the Space for inherited), so use
  // it verbatim — matches the Location column in the Custom Fields manager.
  const cfLabel = (c) => (c.location ? `${c.location} / ${c.label}` : c.label);
  // Built-in fields + the chosen Space's custom fields; hide fields already used in the card.
  const allFields = [...FIELDS.map((f) => ({ value: f.key, label: f.label })),
    ...cfDefs.map((c) => ({ value: c.key, label: cfLabel(c) }))];
  const fieldOpts = allFields.filter((f) => f.value === rule.field || !usedFields?.has(f.value));
  // Empty value for a field: text/single = ''; everything multi = [].
  const emptyFor = (v) => {
    if (v.startsWith('cf:')) return (cfDefs.find((c) => c.key === v)?.type === 'text') ? '' : [];
    return emptyValue(v);
  };
  return (
    <>
      <div style={g.fieldCol} onMouseDown={() => options.onNeedFields?.()}>
        {/* onMouseDown fires before the dropdown opens → load custom-field options on demand. */}
        <Select value={rule.field} onChange={(v) => set({ field: v, value: emptyFor(v) })}
          options={fieldOpts} />
      </div>
      <div style={g.opCol}>
        <Select value={rule.op} onChange={(v) => set({ op: v })} options={OPS} />
      </div>
      <div style={g.valCol}>
        <ValueEditor rule={rule} setVal={setVal} options={options} />
      </div>
      <button type="button" className="icon-btn" style={g.trash} onClick={onRemove} title="Remove"><IconTrash size={16} /></button>
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
    return <MultiSelect active={active} value={arr} onChange={setVal} options={opts} placeholder="Select tasks" onOpen={options.ensureTasks} />;
  }
  if (rule.field === 'space')
    // Wrapper's onMouseDown fires before the Select opens → load Spaces on demand.
    return (
      <span style={{ display: 'block' }} onMouseDown={() => options.ensureSpaces?.()}>
        <Select placeholder="Select option" value={rule.value} onChange={setVal}
          options={options.projects.map((p) => ({ value: p._id, label: p.name || p.key }))} />
      </span>
    );
  if (rule.field === 'type')
    return <MultiSelect active={active} value={arr} onChange={setVal} options={TASK_TYPES} placeholder="Select types" />;
  if (rule.field === 'status')
    return <MultiSelect active={active} value={arr} onChange={setVal} options={options.statuses} placeholder="Select statuses" onOpen={options.ensureSpaces} />;
  if (rule.field === 'list')
    return <MultiSelect active={active} value={arr} onChange={setVal} options={options.lists} placeholder="Select lists" onOpen={options.ensureSpaces} />;
  if (rule.field === 'label')
    return <MultiSelect active={active} value={arr} onChange={setVal} options={options.labels} placeholder="Select labels" onOpen={options.ensureLabels} />;
  // assignee / reporter — multi-select people
  return <UserPicker active={active} value={arr} onChange={setVal} users={options.users}
    myId={options.myId} allowUnassigned={rule.field === 'assignee'} onOpen={options.ensureUsers} />;
}

// Free-text value editor for a text custom field (matches "contains").
function TextFilter({ value, onChange }) {
  return (
    <input value={value || ''} placeholder="Contains text…" onChange={(e) => onChange(e.target.value)}
      className="wg-select-trigger" style={{ ...g.trigger, cursor: 'text' }} />
  );
}

/* --------------------------------------------------------------- MultiSelect */
function MultiSelect({ value, onChange, options, placeholder, active, onOpen }) {
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
      <button type="button" className="wg-select-trigger" style={{ ...g.trigger, ...(open ? g.triggerActive : {}) }}
        onClick={() => { if (!open) onOpen?.(); setOpen((o) => !o); }}>
        <span style={{ color: value.length ? 'var(--c-text)' : 'var(--c-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <IconChevronDown size={14} />
      </button>
      {open && (
        <div style={g.pop}>
          {options.length === 0 && <div style={g.popEmpty}>No options</div>}
          {(() => { let prev = null; return options.map((o, i) => {
            const showHeader = o.group && o.group !== prev; prev = o.group;
            return (
              <Fragment key={`${o.group || ''}::${o.value}::${i}`}>
                {showHeader && <div style={g.groupHeader}>{o.group}</div>}
                <button type="button" style={g.popItem} onClick={() => toggle(o.value)}>
                  <span style={{ ...g.checkbox, ...(value.includes(o.value) ? g.checkboxOn : {}) }}>{value.includes(o.value) ? '✓' : ''}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                </button>
              </Fragment>
            );
          }); })()}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------- UserPicker (multi-select) */
function UserPicker({ value, onChange, users, myId, allowUnassigned, active, onOpen }) {
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
      <button type="button" className="wg-select-trigger" style={{ ...g.trigger, ...(open ? g.triggerActive : {}) }}
        onClick={() => { if (!open) onOpen?.(); setOpen((o) => !o); }}>
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
// A single "Save filter" button. For an existing saved filter it updates it in
// place; for a fresh builder (/filters/new) it prompts for a name and creates one.
function SaveFilterButton({ cards, conj, routeId, onSaved }) {
  const promptDialog = usePrompt();
  const toast = useToast();
  const navigate = useNavigate();
  const isExisting = routeId && routeId !== 'new';
  // Nothing to save until at least one filter rule has a value.
  const hasFilters = (cards || []).some(nodeActive);
  const save = async () => {
    if (!hasFilters) return;
    if (isExisting) {
      try {
        await savedFiltersApi.update(routeId, { cards, conj });
        window.dispatchEvent(new Event('wg-saved-filters-changed'));
        onSaved?.(); // update the parent's "last saved" snapshot so Cancel reverts to this
        toast.success('Filter saved');
      } catch { toast.error('Could not save filter'); }
      return;
    }
    const name = await promptDialog({ title: 'Save filter', message: 'Give this filter a name.', placeholder: 'Filter name', confirmLabel: 'Save' });
    if (!name || !name.trim()) return;
    try {
      const created = await savedFiltersApi.create({ name: name.trim(), cards, conj });
      window.dispatchEvent(new Event('wg-saved-filters-changed'));
      toast.success(`Filter "${created.name}" created`);
      navigate(`/filters/${created.id}`); // give the new filter its own route
    } catch { toast.error('Could not create filter'); }
  };
  return (
    <button type="button" className="btn btn-primary" style={{ ...g.saveBtn, ...(!hasFilters ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
      onClick={save} disabled={!hasFilters} title={hasFilters ? 'Save filter' : 'Add a filter first'}>Save filter</button>
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
    color: 'var(--c-muted)', cursor: 'pointer', borderRadius: 8, flexShrink: 0 },
  nestedLinkRow: { paddingLeft: 92 },
  nestedLinkFlush: { paddingLeft: 0 },
  linkBtn: { background: 'none', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 13, padding: '2px 4px' },
  footer: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 },
  triggerActive: { borderColor: 'var(--c-primary)', boxShadow: '0 0 0 2px var(--c-primary-weak)' },
  addFilter: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600 },
  removeGroup: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: '1px solid var(--c-border)',
    background: 'var(--c-surface)', color: 'var(--c-muted)', cursor: 'pointer', borderRadius: 8 },
  savedBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5 },
  saveBtn: { fontSize: 13.5, fontWeight: 600, padding: '8px 16px' },
  trigger: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', height: 38,
    padding: '0 12px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8,
    cursor: 'pointer', fontSize: 14, color: 'var(--c-text)' },
  pop: { position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 40, minWidth: 240, maxWidth: 320, maxHeight: 280, overflowY: 'auto',
    background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, boxShadow: '0 12px 32px rgba(16,24,40,.16)', padding: 6 },
  popItem: { display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', background: 'none', border: 'none',
    padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: 'var(--c-text)' },
  popEmpty: { padding: '10px 12px', fontSize: 13, color: 'var(--c-muted)' },
  groupHeader: { padding: '8px 10px 4px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--c-faint)' },
  popDivider: { height: 1, background: 'var(--c-border)', margin: '4px 0' },
  // Always a clearly-visible box: surface fill + a solid border when empty, so an
  // unchecked option never looks like it's missing a checkbox.
  checkbox: { width: 18, height: 18, borderRadius: 5, border: '1.5px solid var(--c-border)', background: 'var(--c-surface)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, lineHeight: 1,
    color: '#fff', flexShrink: 0, boxSizing: 'border-box' },
  checkboxOn: { background: 'var(--c-primary)', borderColor: 'var(--c-primary)' },
  searchRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 8px', color: 'var(--c-faint)', borderBottom: '1px solid var(--c-border)', marginBottom: 4 },
  searchInput: { flex: 1, border: 'none', outline: 'none', background: 'none', fontSize: 14, color: 'var(--c-text)' },
  savedRow: { display: 'flex', alignItems: 'center' },
  avatarMuted: { width: 22, height: 22, borderRadius: '50%', background: 'var(--c-surface-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-muted)', flexShrink: 0 },
  avatarMe: { width: 22, height: 22, borderRadius: '50%', background: 'var(--c-primary)', color: 'var(--c-on-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 },
};

const s = {
  // Full-height column: tabs stay at the top, the results area (viewArea) fills the
  // rest so its pager pins to the bottom of the screen (inset by the app's padding).
  // Extend into the app main's 24px bottom padding (negative margin) so the pager sits
  // flush at the very bottom of the screen instead of leaving a gap below it.
  page: { display: 'flex', flexDirection: 'column', height: 'calc(100% + 24px)', minHeight: 0, marginBottom: -24 },
  viewArea: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
  crumbs: { display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 },
  crumbLink: { background: 'none', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 15, fontWeight: 600, padding: 0 },
  crumbSep: { color: 'var(--c-faint)', fontSize: 15 },
  crumbCurrentWrap: { display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 },
  crumbCurrent: { color: 'var(--c-text-strong)', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  crumbEdit: { color: 'var(--c-faint)', padding: 4, borderRadius: 6 },
  crumbInput: { fontSize: 15, fontWeight: 700, color: 'var(--c-text-strong)', background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 8, padding: '4px 10px', minWidth: 160 },
  builder: { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12,
    boxShadow: 'var(--sh-xs)', padding: 16, marginBottom: 16 },
  footerRight: { display: 'inline-flex', alignItems: 'center', gap: 10 },
  tabs: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    borderBottom: '1px solid var(--c-border)', marginBottom: 16 },
  tabsLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  tab: { display: 'inline-flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer',
    padding: '10px 6px', fontSize: 14, fontWeight: 600, color: 'var(--c-muted)', borderBottom: '2px solid transparent' },
  tabActive: { color: 'var(--c-text-strong)', borderBottom: '2px solid var(--c-text-strong)' },
  addBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--c-primary)',
    color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  // Members table
  mCard: { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, boxShadow: 'var(--sh-xs)', overflow: 'hidden' },
  mTable: { width: '100%', borderCollapse: 'collapse' },
  mTh: { textAlign: 'left', padding: '11px 16px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.03em',
    color: 'var(--c-muted)', background: 'var(--c-surface-2)' },
  mRow: { borderTop: '1px solid var(--c-border-2)' },
  mTd: { padding: '12px 16px', fontSize: 14, color: 'var(--c-text)', verticalAlign: 'middle' },
  mName: { color: 'var(--c-text-strong)', fontWeight: 600 },
  mEmpty: { padding: 28, textAlign: 'center', color: 'var(--c-muted)' },
  ownerTag: { fontSize: 12, fontWeight: 600, color: 'var(--c-muted)', background: 'var(--c-surface-2)', padding: '3px 10px', borderRadius: 999 },
  removeLink: { border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, padding: '5px 12px', borderRadius: 8 },
  // Right-corner controls in the View/Members tab bar
  tabsRight: { display: 'inline-flex', alignItems: 'center', gap: 12 },
  rCount: { fontSize: 13, color: 'var(--c-muted)', whiteSpace: 'nowrap' },
  filterToggle: { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600 },
  filterToggleActive: { borderColor: 'var(--c-primary)', color: 'var(--c-primary)' },
  filterBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, padding: '0 5px',
    borderRadius: 999, background: 'var(--c-primary)', color: 'var(--c-on-primary)', fontSize: 11, fontWeight: 700 },
  colBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600 },
  colMenu: { position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 40, minWidth: 180, background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 10, boxShadow: '0 12px 32px rgba(16,24,40,.16)', padding: 6 },
  colMenuItem: { display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: 'var(--c-text)' },
  colCheck: { width: 18, height: 18, borderRadius: 5, border: '1px solid var(--c-border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', flexShrink: 0 },
  colCheckOn: { background: 'var(--c-primary)', borderColor: 'var(--c-primary)' },
  // Results table (fixed layout so column widths apply; resize handles on headers)
  // Fill the remaining viewport height and lay out as a column: the rows scroll
  // internally (rScroll) while the pager stays pinned at the card's bottom.
  rCard: { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12,
    boxShadow: 'var(--sh-xs)', overflow: 'hidden', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
  rScroll: { flex: 1, minHeight: 0, overflow: 'auto' },
  rTable: { width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' },
  // Sticky header: stays pinned at the top while the rows scroll inside rScroll.
  // (sticky still establishes a positioning context for the absolute resize handle.)
  rTh: { position: 'sticky', top: 0, zIndex: 2, textAlign: 'left', padding: '10px 14px', fontSize: 12,
    textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--c-muted)', background: 'var(--c-surface-2)', userSelect: 'none' },
  rThLabel: { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rResize: { position: 'absolute', top: 0, right: 0, width: 7, height: '100%', cursor: 'col-resize' },
  rColLine: { borderRight: '1px solid var(--c-border-2)' },
  rRow: { borderTop: '1px solid var(--c-border-2)', cursor: 'pointer' },
  rTd: { padding: '11px 14px', fontSize: 14, color: 'var(--c-text)', verticalAlign: 'middle' },
  rClip: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  // Sits at the bottom of the flex column (the card fills the viewport height), so
  // it's always pinned to the bottom of the screen regardless of the row count.
  pager: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
    padding: '10px 14px', borderTop: '1px solid var(--c-border)', background: 'var(--c-surface)', flexShrink: 0 },
  pagerLeft: { display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--c-muted)' },
  pageSelect: { minWidth: 72, padding: '2px 10px', fontSize: 13, lineHeight: 1.3, borderRadius: 8 },
  pagerRight: { display: 'inline-flex', alignItems: 'center', gap: 8 },
  pagerRange: { fontSize: 13, color: 'var(--c-muted)', whiteSpace: 'nowrap' },
  pagerPage: { fontSize: 13, color: 'var(--c-text)', minWidth: 54, textAlign: 'center' },
  pagerBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30,
    border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text)', borderRadius: 8,
    cursor: 'pointer', fontSize: 18, lineHeight: 1 },
  pagerDisabled: { color: 'var(--c-faint)', cursor: 'not-allowed', opacity: 0.6 },
  // bulk action bar
  bulkBar: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid var(--c-border)',
    background: 'var(--c-surface-2)' },
  bulkCount: { fontSize: 13, fontWeight: 700, color: 'var(--c-text-strong)', marginRight: 4 },
  bulkBtn: { fontSize: 13, fontWeight: 600, padding: '6px 12px' },
  bulkClear: { marginLeft: 'auto', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 15, padding: 4 },
  bulkEdit: { position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, width: 300, background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(16,24,40,.2)', padding: 12 },
  bulkEditHead: { fontSize: 13.5, fontWeight: 700, color: 'var(--c-text-strong)', marginBottom: 8 },
  bulkRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  bulkLbl: { width: 62, fontSize: 13, color: 'var(--c-text)', flexShrink: 0 },
  bulkDate: { flex: 1, padding: '7px 9px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)', color: 'var(--c-text)' },
  bulkEditFoot: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  cardBlock: { marginBottom: 10 },
  cardDivider: { display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' },
  cardDividerText: { fontSize: 12, fontWeight: 700, letterSpacing: '.03em', color: 'var(--c-muted)', paddingLeft: 8 },
  builderFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  clearAllBtn: { fontSize: 13.5, color: 'var(--c-muted)' },
  cancelBtn: { fontSize: 13.5, color: 'var(--c-text)', border: '1px solid var(--c-border)', background: 'var(--c-surface)' },
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
