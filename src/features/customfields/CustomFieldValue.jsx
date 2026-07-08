import { useEffect, useRef, useState } from 'react';
import { tasksApi, PRIORITY_COLOR, resolveStatuses, isDoneStatus } from '../tasks/tasksApi';
import { projectsApi } from '../projects/projectsApi';
import { listsApi } from '../lists/listsApi';
import TaskModal from '../tasks/TaskModal';

const shortDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

/**
 * Renders the value editor for a custom field on a task — ClickUp-style.
 * Controlled: calls onChange(newValue) on every edit (parent decides persistence).
 *  - text         → inline input/textarea, commits on blur/Enter
 *  - dropdown     → colored chip(s) + options popover (single or multiple)
 *  - relationship → linked-task chips + task search popover (link/unlink/open)
 */
export default function CustomFieldValue({ field, value, onChange, spaceId, onOpenTask, currentListId }) {
  if (field.type === 'text') return <TextValue field={field} value={value} onChange={onChange} />;
  if (field.type === 'dropdown') return <DropdownValue field={field} value={value} onChange={onChange} />;
  if (field.type === 'relationship') return <RelationshipValue field={field} value={value} onChange={onChange} spaceId={spaceId} onOpenTask={onOpenTask} currentListId={currentListId} />;
  return <span style={{ color: '#9ca3af', fontSize: 13 }}>—</span>;
}

function TextValue({ field, value, onChange }) {
  const [v, setV] = useState(value || '');
  useEffect(() => { setV(value || ''); }, [value]);
  const commit = () => { if ((v || '') !== (value || '')) onChange(v); };
  if (field.config?.multiline) {
    return <textarea style={t.textArea} value={v} placeholder="Empty"
      onChange={(e) => setV(e.target.value)} onBlur={commit} />;
  }
  return <input style={t.text} value={v} placeholder="Empty"
    onChange={(e) => setV(e.target.value)} onBlur={commit}
    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />;
}

function DropdownValue({ field, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const options = field.config?.options || [];
  const multiple = !!field.config?.multiple;
  const selected = multiple ? (Array.isArray(value) ? value : (value ? [value] : [])) : (value ? [value] : []);
  const optBy = (lbl) => options.find((o) => o.label === lbl);

  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    // Capture phase: fires before an ancestor modal can stopPropagation() the event.
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [open]);

  const pick = (lbl) => {
    if (multiple) onChange(selected.includes(lbl) ? selected.filter((x) => x !== lbl) : [...selected, lbl]);
    else { onChange(value === lbl ? '' : lbl); setOpen(false); }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button style={t.trigger} onClick={() => setOpen((o) => !o)}>
        {selected.length === 0 ? <span style={t.empty}>Empty</span> : selected.map((lbl) => {
          const o = optBy(lbl);
          return <span key={lbl} style={{ ...t.chip, background: `${o?.color || '#6b7280'}22`, color: o?.color || '#6b7280' }}>{lbl}</span>;
        })}
        <span style={t.caret}>⌄</span>
      </button>
      {open && (
        <div style={t.popover}>
          {options.length === 0 && <div style={t.popEmpty}>No options</div>}
          {options.map((o) => (
            <button key={o.label} style={t.optRow} onClick={() => pick(o.label)}>
              <span style={{ ...t.dot, background: o.color }} />
              <span style={{ flex: 1 }}>{o.label}</span>
              {selected.includes(o.label) && <span style={{ color: '#111827' }}>✓</span>}
            </button>
          ))}
          {selected.length > 0 && <button style={{ ...t.optRow, color: '#9ca3af' }} onClick={() => onChange(multiple ? [] : '')}>⊘ Clear</button>}
        </div>
      )}
    </div>
  );
}

function RelationshipValue({ field, value, onChange, spaceId, onOpenTask, currentListId }) {
  const ids = Array.isArray(value) ? value : (value ? [value] : []);
  const [meta, setMeta] = useState({}); // id -> {key,title}
  const [sts, setSts] = useState([]);   // resolved Space statuses (to detect "done")
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [creating, setCreating] = useState(false);
  const [scopeLabel, setScopeLabel] = useState('Tasks'); // e.g. the List/Space name shown in the picker header
  const [space, setSpace] = useState(null); // full Space object (for the Create-Task modal)
  const [targetListObj, setTargetListObj] = useState(null); // the field's target List (may have custom statuses)
  const [createOpen, setCreateOpen] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  // Resolve the Space's status workflow so we can count completed vs pending.
  useEffect(() => {
    if (!spaceId) return;
    projectsApi.get(spaceId).then((sp) => { setSpace(sp); setSts(resolveStatuses(sp)); setScopeLabel((cur) => (cur === 'Tasks' ? (sp.name || 'Tasks') : cur)); }).catch(() => setSts([]));
  }, [spaceId]);

  // Completed / pending summary over the linked tasks.
  const done = ids.filter((id) => meta[id]?.status && isDoneStatus(sts, meta[id].status)).length;
  const pending = ids.length - done;
  const pct = ids.length ? Math.round((done / ids.length) * 100) : 0;

  // Resolve linked-task details (key, title, priority, due date, status).
  useEffect(() => {
    ids.forEach((id) => {
      if (!meta[id]) tasksApi.get(id).then((tk) => setMeta((m) => ({
        ...m, [id]: { key: tk.key, title: tk.title, priority: tk.priority, due_date: tk.due_date, status: tk.status },
      }))).catch(() => {});
    });
  }, [value]); // eslint-disable-line

  // Search candidates within the field's scope (whole Space, or a specific List).
  // Reverse case: when the current task itself lives in the field's target List
  // (e.g. an EPICS task on the "Epic" field scoped to EPICS), searching that List
  // would only offer sibling epics. Instead search the rest of the Space and offer
  // the OTHER lists' tasks — linking one records the child→epic relation.
  const targetList = field.config?.related_to === 'list' && field.config?.list_id
    ? String(field.config.list_id) : null;
  const onTargetList = !!(targetList && currentListId && String(currentListId) === targetList);
  const scope = (targetList && !onTargetList) ? { list_id: targetList } : { project_id: spaceId };
  // When the field targets a specific List, show that List's name in the header and
  // keep the List object — new tasks land in this List, whose custom statuses (if any)
  // override the Space's, so the Create-Task modal must use the List's workflow.
  useEffect(() => {
    if (targetList && !onTargetList) listsApi.get(targetList)
      .then((l) => { setScopeLabel(l.name || 'Tasks'); setTargetListObj(l); }).catch(() => {});
  }, [targetList, onTargetList]);

  // Statuses valid for a task created in the field's scope: the target List's own
  // workflow when it has custom statuses, otherwise the Space's.
  const createListId = (targetList && !onTargetList) ? targetList : (currentListId || null);
  const modalStatuses = (targetListObj?.status_mode === 'custom' && targetListObj.statuses?.length)
    ? resolveStatuses(targetListObj) : sts;
  // Load the scope's candidate tasks ONCE when the picker opens (unfiltered). We
  // filter them client-side as you type so the existing tasks stay visible even
  // while typing a brand-new name — the query never empties the list.
  useEffect(() => {
    if (!open) return undefined;
    tasksApi.list({ ...scope, limit: 50, sort_by: 'created_at', sort_dir: -1 })
      .then((r) => setResults((r.items || []).filter((x) =>
        !ids.includes(x._id) && (!onTargetList || String(x.list_id) !== targetList))))
      .catch(() => setResults([]));
  }, [open]); // eslint-disable-line

  // Client-side substring filter; if nothing matches, keep showing all candidates.
  // Exclude tasks already linked (ids change as you link, without a refetch).
  const q = query.trim().toLowerCase();
  const candidates = results.filter((r) => !ids.includes(r._id));
  const matched = q ? candidates.filter((r) => `${r.title} ${r.key}`.toLowerCase().includes(q)) : candidates;
  const shown = matched.length ? matched : candidates;

  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    // Capture phase: fires before an ancestor modal can stopPropagation() the event.
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [open]);

  const link = (tk) => { onChange([...ids, tk._id]); setQuery(''); };
  const unlink = (id) => onChange(ids.filter((x) => x !== id));

  // Create a brand-new task in the field's scope (its target List, or the current
  // List / Space) and immediately link it — so you don't have to leave the picker.
  // `openAfter` opens the new task's detail so an un-named ("New task") placeholder
  // can be filled in right away.
  const createAndLink = async (openAfter = false) => {
    if (creating) return;
    const typed = query.trim();
    const title = typed || 'New task';
    setCreating(true);
    try {
      const payload = { project_id: spaceId, title };
      if (modalStatuses[0]?.key) payload.status = modalStatuses[0].key;
      if (createListId) payload.list_id = createListId;
      const created = await tasksApi.create(payload);
      onChange([...ids, created._id]);
      setQuery(''); setOpen(false);
      // Open the new task when it was created blank so the user can rename it.
      if (openAfter && !typed) onOpenTask?.(created._id);
    } catch { /* surfaced by apiClient toast */ }
    finally { setCreating(false); }
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {/* Progress bar only on the field's OWN (create) List — hidden on the
          related/target List, which is the reverse side of the relationship. */}
      {ids.length > 0 && !onTargetList && (
        <div style={t.relSummary}>
          <div style={t.relBar}><div style={{ ...t.relBarFill, width: `${pct}%` }} /></div>
          <span style={t.relSummaryText}>
            <b style={{ color: '#16a34a' }}>{done}</b> completed · <b style={{ color: '#f59e0b' }}>{pending}</b> pending
            <span style={{ color: '#9ca3af' }}> · {ids.length} total</span>
          </span>
        </div>
      )}
      {ids.length > 0 && (
        <div style={t.relList}>
          {/* Column header (ClickUp-style related table) */}
          <div style={t.relHead}>
            <span style={{ flex: 1 }}>Name</span>
            <span style={t.relCol}>Due date</span>
            <span style={t.relColSm}>Priority</span>
            <span style={{ width: 22 }} />
          </div>
          {ids.map((id) => {
            const m = meta[id] || {};
            return (
              <div key={id} className="wg-rel-row" style={t.relRow}>
                <span style={t.relName} onClick={() => onOpenTask?.(id)} title="Open task">
                  <span style={t.relKey}>{m.key || '…'}</span>
                  <span style={t.relTitle}>{m.title || ''}</span>
                </span>
                <span style={t.relCol}>{m.due_date ? shortDate(m.due_date) : '—'}</span>
                <span style={t.relColSm}>
                  {m.priority
                    ? <span style={{ ...t.priChip, color: PRIORITY_COLOR[m.priority], background: `${PRIORITY_COLOR[m.priority]}1a` }}>{m.priority}</span>
                    : '—'}
                </span>
                <button style={t.relX} title="Unlink" onClick={() => unlink(id)}>✕</button>
              </div>
            );
          })}
        </div>
      )}
      <button style={t.addTask} onClick={() => setOpen((o) => !o)}>+ Add</button>
      {open && (
        <div style={t.relPop}>
          <input ref={inputRef} autoFocus style={t.relSearch} placeholder="Search…" value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !results.some((r) => r.title.toLowerCase() === q)) createAndLink(); }} />

          {/* Scope header — the List/Space name + a "+" that creates a task here (always visible, ClickUp-style) */}
          <div style={t.relScopeHead}>
            <span style={t.relScopeName}>{scopeLabel}</span>
            <button className="icon-btn" style={t.relScopePlus} title={`Create task in ${scopeLabel}`} onClick={() => { setOpen(false); setCreateOpen(true); }}>＋</button>
          </div>

          <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 2 }}>
            {/* When you type a name, offer to create it explicitly. */}
            {query.trim() && (
              <button style={t.relCreate} onClick={() => createAndLink(false)} disabled={creating}>
                <span style={t.relCreatePlus}>＋</span>
                <span style={{ flex: 1, textAlign: 'left' }}>
                  {creating ? 'Creating…' : <>Create task “<b>{query.trim()}</b>”</>}
                </span>
              </button>
            )}
            {shown.length === 0 && !query.trim() && <div style={t.relEmpty}>No tasks yet — type a name to create one</div>}
            {shown.map((r) => (
              <button key={r._id} style={t.relResult} onClick={() => link(r)}>
                <span style={t.relKey}>{r.key}</span><span style={{ flex: 1, textAlign: 'left' }}>{r.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Full Create-Task modal scoped to the related List — opened by the header "+".
          On save, the created task is linked to this field automatically. */}
      {createOpen && space && (!targetList || onTargetList || targetListObj) && (
        <TaskModal open={createOpen} mode="create" projects={[space]} defaultProjectId={spaceId}
          listId={createListId} listName={scopeLabel} statuses={modalStatuses}
          onClose={() => setCreateOpen(false)}
          onSaved={(created) => { setCreateOpen(false); if (created?._id) onChange([...ids, created._id]); }} />
      )}
    </div>
  );
}

const t = {
  text: { minWidth: 150, maxWidth: 240, padding: '7px 9px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 14 },
  textArea: { minWidth: 200, maxWidth: 300, minHeight: 56, padding: '7px 9px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' },
  trigger: { display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 130, padding: '6px 9px', border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 13 },
  empty: { color: '#9ca3af' },
  chip: { fontSize: 12, fontWeight: 600, borderRadius: 999, padding: '2px 9px' },
  caret: { marginLeft: 'auto', color: '#9ca3af' },
  popover: { position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: 200, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 14px 34px rgba(16,24,40,.18)', zIndex: 30, padding: 5 },
  popEmpty: { padding: '8px 10px', color: '#9ca3af', fontSize: 13 },
  optRow: { display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 7, fontSize: 14, color: '#374151' },
  dot: { width: 11, height: 11, borderRadius: '50%', flexShrink: 0 },
  // Related-task table (ClickUp-style)
  relSummary: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  relBar: { flex: 1, maxWidth: 200, height: 7, borderRadius: 999, background: '#eef0f3', overflow: 'hidden' },
  relBarFill: { height: '100%', background: '#16a34a', borderRadius: 999, transition: 'width .3s' },
  relSummaryText: { fontSize: 12.5, color: '#374151', whiteSpace: 'nowrap' },
  relList: { border: '1px solid #eef0f3', borderRadius: 10, overflow: 'hidden', marginBottom: 8 },
  relHead: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: '#f9fafb',
    borderBottom: '1px solid #eef0f3', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '.03em' },
  relRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid #f3f4f6', fontSize: 13.5 },
  relName: { flex: 1, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 0 },
  relKey: { color: '#4f46e5', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 },
  relTitle: { cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#111827' },
  relCol: { width: 78, flexShrink: 0, color: '#6b7280', fontSize: 12.5 },
  relColSm: { width: 80, flexShrink: 0 },
  priChip: { fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '2px 8px', textTransform: 'capitalize' },
  relX: { background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 12, width: 22, flexShrink: 0 },
  addTask: { border: '1px dashed #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer', background: '#fff' },
  relPop: { position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: 300, maxWidth: '100%', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 14px 34px rgba(16,24,40,.18)', zIndex: 30, padding: 8 },
  relSearch: { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 },
  relEmpty: { padding: '10px', color: '#9ca3af', fontSize: 13, textAlign: 'center' },
  relResult: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 7, fontSize: 14 },
  relScopeHead: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px 4px', marginTop: 4,
    borderTop: '1px solid #f3f4f6' },
  relScopeName: { flex: 1, fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'none',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  relScopePlus: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22,
    borderRadius: 6, border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 16, flexShrink: 0 },
  relCreate: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', marginBottom: 2,
    background: 'none', border: 'none', cursor: 'pointer', borderRadius: 7, fontSize: 14, color: '#4f46e5' },
  relCreatePlus: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18,
    borderRadius: 5, background: '#eef2ff', color: '#4f46e5', fontSize: 13, fontWeight: 700, flexShrink: 0 },
};
