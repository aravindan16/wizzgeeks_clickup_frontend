import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download } from 'lucide-react';
import { tasksApi, resolveStatuses, statusLabel } from '../tasks/tasksApi';
import { projectsApi } from '../projects/projectsApi';
import { listsApi } from '../lists/listsApi';
import { labelsApi } from '../labels/labelsApi';
import { dashboardsApi } from '../dashboard/dashboardsApi';
import { customFieldsApi } from '../customfields/customFieldsApi';
import { savedFiltersApi } from '../filters/savedFiltersApi';
import FilterBuilder, { newGroup, nodeActive } from '../filters/FilterBuilder';
import {
  findContextSpaceId, findContextListId, statusesBySpace, buildStatusOptions, buildListOptions,
} from '../filters/filterOptions';
import { useAuth } from '../auth/useAuth';
import { IconFilter, IconListCheck, IconChevronDown } from '../../components/icons';
import { useHeaderSlot } from '../../layouts/headerSlot';
import { useToast } from '../../components/Toast';
import Select from '../../components/Select';
import ResizableTable from '../../components/ResizableTable';

const asItems = (r) => (Array.isArray(r) ? r : r?.items || []);
const fmtDate = (v) => (v ? String(v).slice(0, 10) : '');
// Start/end dates are a plain "YYYY-MM-DD" or an automatic UTC timestamp (set when the
// status moved to Active / Done) → the sheet shows local "YYYY-MM-DD HH:MM".
const pad2 = (n) => String(n).padStart(2, '0');
const fmtTaskDay = (v) => {
  if (!v) return '';
  const str = String(v);
  if (!str.includes('T')) return str.slice(0, 10);
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return str.slice(0, 16).replace('T', ' ');
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const cap = (v) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : '');

// Every exportable column: key, header, and how to read it from a task + lookup maps.
const COLUMNS = [
  { key: 'key', label: 'Task ID', get: (t) => t.key },
  { key: 'title', label: 'Title', get: (t) => t.title },
  { key: 'description', label: 'Description', get: (t) => t.description || '' },
  { key: 'space', label: 'Space', get: (t, m) => m.spaces[t.project_id]?.name || '' },
  { key: 'list', label: 'List', get: (t, m) => m.lists[t.list_id] || '' },
  { key: 'status', label: 'Status', get: (t, m) => statusLabel(m.statusesFor(t), t.status) },
  { key: 'priority', label: 'Priority', get: (t) => cap(t.priority) },
  { key: 'type', label: 'Type', get: (t) => cap(t.type) },
  { key: 'assignee', label: 'Assignee', get: (t, m) => m.users[t.assignee_id] || '' },
  { key: 'reporter', label: 'Reporter', get: (t, m) => m.users[t.reporter_id] || '' },
  { key: 'labels', label: 'Labels', get: (t) => (t.labels || []).join(', ') },
  { key: 'start_date', label: 'Start date', get: (t) => fmtTaskDay(t.start_date) },
  { key: 'due_date', label: 'Due date', get: (t) => fmtTaskDay(t.end_date || t.due_date) },
  { key: 'estimate_hours', label: 'Estimate (h)', get: (t) => t.estimate_hours ?? '' },
  { key: 'actual_hours', label: 'Time logged (h)', get: (t) => t.actual_hours ?? '' },
  { key: 'created_at', label: 'Created', get: (t) => fmtDate(t.created_at) },
  { key: 'updated_at', label: 'Updated', get: (t) => fmtDate(t.updated_at) },
];
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Signature of the EFFECTIVE rule tree (ignores ids and empty rules), so picking a
// field before a value doesn't re-count.
const ruleSig = (cards, conj) => {
  const norm = (n) => (n.type === 'group'
    ? { t: 'g', c: n.conj, ch: (n.children || []).filter(nodeActive).map(norm) }
    : { t: 'r', f: n.field, o: n.op, v: n.value });
  return JSON.stringify({ conj, cards: (cards || []).filter(nodeActive).map(norm) });
};
// Fresh ids for a loaded saved filter's tree (ids must be unique within the builder).
let _rid = 0;
const reId = (node) => ({
  ...node,
  id: `x${_rid++}_${Math.random().toString(36).slice(2, 8)}`,
  ...(node.type === 'group' ? { children: (node.children || []).map(reId) } : {}),
});

const NEW_FILTER = '__new__';

const DEFAULT_COLS = ['key', 'title', 'space', 'list', 'status', 'priority', 'assignee', 'due_date', 'created_at'];

// Lookup maps (Space / List / people names, per-task statuses) for rendering task rows,
// from the page's reference data plus whatever an evaluate() response bundled.
function buildMaps({ projects, lists, users }, res = {}) {
  const spaceById = Object.fromEntries([...projects, ...(res.spaces || [])].map((p) => [String(p._id), p]));
  const listById = Object.fromEntries([...lists, ...(res.lists || [])].map((l) => [String(l._id), l]));
  const userName = {};
  [...users, ...(res.users || [])].forEach((u) => { userName[String(u.user_id)] = u.full_name || u.email; });
  const stsCache = {};
  return {
    spaces: spaceById,
    lists: Object.fromEntries(Object.values(listById).map((l) => [String(l._id), l.name])),
    users: userName,
    // A task's statuses: its List's custom set (if any) + its Space's.
    statusesFor: (t) => {
      const ck = `${t.project_id}|${t.list_id || ''}`;
      if (stsCache[ck]) return stsCache[ck];
      const sp = spaceById[String(t.project_id)];
      const base = sp ? resolveStatuses(sp) : [];
      const l = listById[String(t.list_id)];
      let out = base;
      if (l && l.status_mode === 'custom' && l.statuses?.length) {
        out = resolveStatuses(l).slice();
        const keys = new Set(out.map((x) => x.key));
        base.forEach((x) => { if (!keys.has(x.key)) out.push(x); });
      }
      stsCache[ck] = out;
      return out;
    },
  };
}

// Preview-table column widths (px); unlisted columns get the default.
const COL_WIDTH = { key: 110, title: 260, description: 260, space: 150, list: 150, status: 140, priority: 100,
  type: 90, assignee: 150, reporter: 150, labels: 150, start_date: 120, due_date: 120,
  estimate_hours: 110, actual_hours: 130, created_at: 110, updated_at: 110 };

const csvCell = (v) => {
  const str = v == null ? '' : String(v);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

function downloadCsv(filename, rows) {
  // BOM so Excel opens UTF-8 (names with accents, emoji) correctly.
  const blob = new Blob(['﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')],
    { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Export tasks to CSV (opens in Excel / Google Sheets). Uses the SAME filter builder
 * and server-side evaluator as the Filters page, so an
 * export contains exactly the tasks that filter shows.
 */
export default function ExportPage() {
  const slotEl = useHeaderSlot();
  const toast = useToast();
  const { user } = useAuth();
  const myId = user?._id || user?.id;
  const [projects, setProjects] = useState([]);  // Spaces
  const [lists, setLists] = useState([]);        // {_id, name, spaceId, spaceName, status_mode, statuses}
  const [users, setUsers] = useState([]);        // {user_id, full_name, email}
  const [labels, setLabels] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [allTasks, setAllTasks] = useState([]);  // only for relationship custom-field pickers
  const [saved, setSaved] = useState([]);        // saved filters (to start from)
  // Which filter is chosen: '' = all tasks (no filter), NEW_FILTER, or a saved filter's id.
  const [filterSel, setFilterSel] = useState('');
  const [panelOpen, setPanelOpen] = useState(false); // floating filter panel
  const [colsOpen, setColsOpen] = useState(false);   // floating columns panel
  const [cards, setCards] = useState(() => [newGroup()]);
  const [conj, setConj] = useState('AND');
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [count, setCount] = useState(null);
  const [rows, setRows] = useState([]);          // current preview page
  const [refs, setRefs] = useState({});          // spaces/lists/users bundled with that page
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reference data for the builder's dropdowns (loaded once).
  useEffect(() => {
    (async () => {
      const ps = asItems(await projectsApi.list({ limit: 200 }).catch(() => []));
      setProjects(ps);
      const perSpace = await Promise.all(ps.map((p) => listsApi.forSpace(p._id)
        .then((ls) => asItems(ls).map((l) => ({ ...l, spaceId: p._id, spaceName: p.name || p.key })))
        .catch(() => [])));
      setLists(perSpace.flat());
    })();
    dashboardsApi.searchUsers('').then((u) => setUsers(asItems(u))).catch(() => {});
    labelsApi.list().then(setLabels).catch(() => {});
    savedFiltersApi.list().then(setSaved).catch(() => {});
  }, []);

  const contextSpaceId = useMemo(() => findContextSpaceId(cards, lists), [cards, lists]);
  const contextListId = useMemo(() => findContextListId(cards), [cards]);
  const stsBySpace = useMemo(() => statusesBySpace(projects), [projects]);
  const statusOptions = useMemo(() => buildStatusOptions({ cards, lists, projects, contextSpaceId, stsBySpace }),
    [cards, lists, projects, contextSpaceId, stsBySpace]);
  const listOptions = useMemo(() => buildListOptions(lists, contextSpaceId), [lists, contextSpaceId]);

  // Custom fields of the chosen Space/List are filterable too.
  useEffect(() => {
    if (!contextSpaceId) { setCustomFields([]); return; }
    customFieldsApi.list(contextSpaceId, contextListId || undefined, undefined, { _silent: true })
      .then((fs) => setCustomFields((fs || [])
        .filter((f) => ['dropdown', 'text', 'relationship'].includes(f.type))
        .map((f) => ({ key: `cf:${f._id}`, label: f.name, type: f.type, config: f.config || {} }))))
      .catch(() => setCustomFields([]));
  }, [contextSpaceId, contextListId]);
  // Relationship fields pick from tasks — load them only when such a field exists.
  const needTasks = customFields.some((f) => f.type === 'relationship');
  useEffect(() => {
    if (!needTasks || allTasks.length) return;
    (async () => {
      const all = [];
      for (let skip = 0; skip < 2000; skip += 200) {
        const r = await tasksApi.list({ limit: 200, skip }).catch(() => ({ items: [] }));
        all.push(...(r.items || []));
        if ((r.items || []).length < 200) break;
      }
      setAllTasks(all);
    })();
  }, [needTasks, allTasks.length]);

  const options = {
    projects, lists: listOptions, statuses: statusOptions, users, myId, customFields, tasks: allTasks,
    labels: labels.map((l) => ({ value: l.name, label: l.name })),
  };

  // One dropdown: picking "New filter" or a saved filter opens the builder with its
  // rules; "All tasks" drops the filter and hides the builder.
  const chooseFilter = (sel) => {
    setFilterSel(sel);
    setPanelOpen(!!sel);
    if (sel) setColsOpen(false);
    const f = saved.find((x) => x.id === sel);
    setCards(f?.cards?.length ? f.cards.map(reId) : [newGroup()]);
    setConj(f?.conj || 'AND');
  };

  const sig = useMemo(() => ruleSig(cards, conj), [cards, conj]);

  // New rules → back to the first page.
  useEffect(() => { setPage(0); }, [sig]);

  // Live preview: one page of matching tasks + the total (same server evaluator as the Filters page).
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const h = setTimeout(() => {
      savedFiltersApi.evaluate(cards, conj, { skip: page * pageSize, limit: pageSize })
        .then((r) => { if (alive) { setRows(r.items || []); setCount(r.total ?? 0); setRefs(r); } })
        .catch(() => { if (alive) { setRows([]); setCount(0); } })
        .finally(() => { if (alive) setLoading(false); });
    }, 300);
    return () => { alive = false; clearTimeout(h); };
  }, [sig, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const previewMaps = useMemo(() => buildMaps({ projects, lists, users }, refs), [projects, lists, users, refs]);
  const tableColumns = useMemo(() => COLUMNS.filter((c) => cols.includes(c.key)).map((c) => ({
    key: c.key, label: c.label, width: COL_WIDTH[c.key] || 140, min: 70,
    render: (t) => {
      const v = c.get(t, previewMaps);
      const text = v === '' || v == null ? '—' : String(v);
      return <span style={{ ...s.cell, ...(c.key === 'key' ? s.keyCell : {}) }} title={text}>{text}</span>;
    },
  })), [cols, previewMaps]);

  const toggleCol = (k) => setCols((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));

  const runExport = async () => {
    if (!cols.length) { toast.error('Pick at least one column'); return; }
    setBusy(true);
    try {
      // Every matching task in one call (limit 0 = all), plus the Spaces/Lists/assignees they reference.
      const res = await savedFiltersApi.evaluate(cards, conj, { skip: 0, limit: 0 });
      const tasks = res.items || [];

      const maps = buildMaps({ projects, lists, users }, res);
      const spaceById = maps.spaces;

      const chosen = COLUMNS.filter((c) => cols.includes(c.key));
      const csvRows = [chosen.map((c) => c.label), ...tasks.map((t) => chosen.map((c) => c.get(t, maps)))];
      const scopeName = saved.find((x) => x.id === filterSel)?.name
        || (contextSpaceId && spaceById[contextSpaceId]?.name) || 'tasks';
      const scope = scopeName.replace(/[^\w-]+/g, '-').toLowerCase();
      downloadCsv(`${scope}-${ymd(new Date())}.csv`, csvRows);
      toast.success(`Exported ${tasks.length} task${tasks.length === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={s.page}>
      {slotEl && createPortal(<span style={s.headerTitle}>Export</span>, slotEl)}

      <div style={s.card}>
        <div style={s.filterHead}>
          <button type="button" style={{ ...s.filterIcon, ...(panelOpen ? s.filterIconOn : {}) }} disabled={!filterSel}
            title={filterSel ? (panelOpen ? 'Hide filter' : 'Show filter') : 'Choose a filter first'}
            aria-expanded={panelOpen} onClick={() => { setPanelOpen((o) => !o); setColsOpen(false); }}>
            <IconFilter size={16} />
          </button>
          <Select style={{ minWidth: 240 }} value={filterSel} onChange={chooseFilter}
            options={[
              { value: '', label: 'All tasks (no filter)' },
              { value: NEW_FILTER, label: '+ New filter' },
              ...saved.map((f) => ({ value: f.id, label: f.name })),
            ]} />
          <ColumnsMenu cols={cols} onToggle={toggleCol} open={colsOpen}
            onOpenChange={(o) => { setColsOpen(o); if (o) setPanelOpen(false); }} />
          <button className="btn btn-primary" style={{ ...s.btn, marginLeft: 'auto' }} onClick={runExport}
            disabled={busy || !count || !cols.length}>
            <Download size={16} /> {busy ? 'Exporting…' : 'Export CSV'}
          </button>
          {/* Floats OVER the table (absolute), so opening it never pushes the table down. */}
          {filterSel && panelOpen && (
            <div style={s.filterPanel}>
              <FilterBuilder cards={cards} onCards={setCards} conj={conj} onConj={setConj} options={options}
                footerExtra={<button type="button" className="btn btn-primary" onClick={() => setPanelOpen(false)}>Done</button>} />
            </div>
          )}
        </div>

        {/* Preview of exactly what the CSV will contain (selected columns, one page at a time). */}
        <div style={{ ...s.tableArea, opacity: loading ? 0.6 : 1 }}>
          <ResizableTable key={cols.join('|')} columns={tableColumns} rows={rows} rowKey={(t) => t._id} fillHeight
            emptyText={loading ? 'Loading…' : 'No tasks match these filters.'}
            serverMode page={page} pageSize={pageSize} total={count || 0}
            onPageChange={setPage} onPageSizeChange={(n) => { setPageSize(n); setPage(0); }} />
        </div>



      </div>
    </div>
  );
}

/**
 * "Columns" button → a wide floating panel with a grid of checkboxes choosing which
 * columns go in the CSV (and the preview table). Positioned against the toolbar row
 * (its nearest positioned ancestor), so it spans the full width and floats over the table.
 */
function ColumnsMenu({ cols, onToggle, open, onOpenChange }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onOpenChange(false); };
    const onEsc = (e) => { if (e.key === 'Escape') onOpenChange(false); };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDown, true); document.removeEventListener('keydown', onEsc); };
  }, [open, onOpenChange]);
  return (
    <div ref={ref}>
      <button type="button" className="btn" style={s.colBtn} aria-expanded={open} onClick={() => onOpenChange(!open)}>
        <IconListCheck size={15} /> Columns
        <span style={{ display: 'inline-flex', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <IconChevronDown size={13} />
        </span>
      </button>
      {open && (
        <div style={s.colPanel}>
          <div style={s.colPanelTitle}>Columns</div>
          <div style={s.colGrid}>
            {COLUMNS.map((c) => (
              <label key={c.key} style={s.colCheckRow}>
                <input type="checkbox" checked={cols.includes(c.key)} onChange={() => onToggle(c.key)} />
                {c.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  // Page fills the main area's height: card → flex column → the table takes the rest,
  // scrolling its rows internally with the header and pager pinned (no empty space below).
  page: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 },
  headerTitle: { fontSize: 16, fontWeight: 700, color: 'var(--c-text-strong)' },
  card: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 20, background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 12, boxShadow: 'var(--sh-xs)' },
  tableArea: { flex: 1, minHeight: 240, transition: 'opacity .15s' },
  filterHead: { position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 },
  filterIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8,
    border: '1px solid transparent', background: 'none', color: 'var(--c-muted)', cursor: 'pointer' },
  filterIconOn: { borderColor: 'var(--c-primary)', color: 'var(--c-primary)' },
  // Just positions the builder (which draws its own bordered card) and lifts it above the table.
  filterPanel: { position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 30,
    borderRadius: 12, boxShadow: '0 16px 40px rgba(16,24,40,.18)' },
  cell: { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13.5, color: 'var(--c-text)' },
  keyCell: { color: 'var(--c-primary)', fontWeight: 600 },
  colBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600 },
  colPanel: { position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 30, padding: '14px 16px 16px',
    background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(16,24,40,.18)' },
  colPanelTitle: { fontSize: 15, fontWeight: 700, color: 'var(--c-text-strong)', marginBottom: 10 },
  colGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '10px 16px' },
  colCheckRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--c-text)', cursor: 'pointer' },
  btn: { display: 'inline-flex', alignItems: 'center', gap: 6 },
};
