import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { tasksApi, PRIORITY_COLOR, isDoneStatus } from './tasksApi';
import { useAuth } from '../auth/useAuth';

// Title clamped to 2 lines — only expose a hover tooltip when it actually overflows.
function CardTitle({ text, style }) {
  const ref = useRef(null);
  const [clamped, setClamped] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const check = () => setClamped(el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [text]);
  return <span ref={ref} style={style} title={clamped ? text : undefined}>{text}</span>;
}
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { IconChevronDown, IconCalendar, IconUser, IconEnter, IconExpand, IconTrash,
  IconFieldDropdown, IconFieldText, IconFieldRelationship } from '../../components/icons';
import TaskTypeIcon from '../../components/TaskTypeIcon';

/**
 * Kanban board with drag-and-drop + a Jira-style inline composer per column.
 * The toolbar pickers (work type, due date, assignee) are functional and render
 * as fixed-positioned popovers so they never overlap or get clipped by the board.
 */
// Work types offered when creating tasks (others can be re-enabled later).
const TYPE_OPTIONS = [
  { value: 'task', label: 'Task', icon: '☑️' },
  { value: 'bug', label: 'Bug', icon: '🐛' },
];
// Icons for rendering any existing task type (incl. legacy/subtask).
const TYPE_ICON = { story: '🔖', task: '☑️', bug: '🐛', epic: '🏔️', subtask: '↳' };

// Handles both date-only strings (YYYY-MM-DD, e.g. due_date) and full ISO
// timestamps (created_at / updated_at) — the latter must NOT get a T00:00 suffix.
const shortDate = (d) => {
  if (!d) return '';
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00`) : new Date(d);
  return Number.isNaN(dt.getTime()) ? '' : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const initials = (n) => (n || '?').split(/[\s@.]+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const DEFAULT_CFV = { priority: true, status: false, key: true, assignee: true, due_date: true, labels: true, subtasks: true, created_at: false, closed_at: false };

// A custom-field value rendered as a compact card chip (dropdown / relationship / text).
const cfChipStyle = { fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '2px 8px', background: 'var(--c-surface-2)',
  color: 'var(--c-muted)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' };
const CF_TYPE_ICON = { dropdown: IconFieldDropdown, text: IconFieldText, relationship: IconFieldRelationship };
function renderCustomChip(field, value) {
  const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
  // When enabled but empty, show only the field's type icon (no text) so it stays compact.
  if (empty) {
    const Ic = CF_TYPE_ICON[field.type] || IconFieldText;
    return <span key={field._id} style={{ ...cfChipStyle, color: 'var(--c-faint)', padding: '3px 7px' }} title={field.name}><Ic size={13} /></span>;
  }
  if (field.type === 'dropdown') {
    const vals = Array.isArray(value) ? value : [value];
    const opt = (field.config?.options || []).find((o) => o.label === vals[0]);
    const c = opt?.color || '#6b7280';
    return <span key={field._id} style={{ ...cfChipStyle, color: c, background: `${c}1a` }} title={vals.join(', ')}>{vals.join(', ')}</span>;
  }
  return <span key={field._id} style={cfChipStyle} title={String(value)}>{String(value)}</span>;
}
const relCount = (value) => (Array.isArray(value) ? value.length : (value ? 1 : 0));

function KanbanBoard({ tasks, onChanged, projectId, listId = null, members = [], statuses = [], onOpenTask, cardFields = null, cardCustom = [] }) {
  const open = onOpenTask || (() => {});
  const cfv = cardFields || DEFAULT_CFV;
  const { can, user } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const me = user?._id || user?.id;
  const [dragId, setDragId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null); // status key currently hovered while dragging
  const [error, setError] = useState(null);

  // Local mirror of the tasks prop so a drag can update the board instantly
  // (optimistic) instead of waiting for the server round-trip + parent refetch.
  const [board, setBoard] = useState(tasks);
  useEffect(() => { setBoard(tasks); }, [tasks]);

  // Columns come from the space's own workflow. Include any orphan statuses found
  // on tasks (e.g. legacy) so nothing is hidden.
  const columns = [...statuses];
  board.forEach((t) => {
    if (!columns.some((c) => c.key === t.status)) columns.push({ key: t.status, name: t.status, color: '#6b7280' });
  });

  // Composer state
  const [composerStatus, setComposerStatus] = useState(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('task');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [picker, setPicker] = useState(null); // { name, x, y }
  const [memberQuery, setMemberQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [cardMenu, setCardMenu] = useState(null); // { id, x, y }
  const [assignFor, setAssignFor] = useState(null); // { id, x, y } — inline assignee picker on a card
  const [assignQuery, setAssignQuery] = useState('');
  const [relFor, setRelFor] = useState(null); // { taskId, field, x, y } — inline relationship picker
  const [relQuery, setRelQuery] = useState('');
  const [relResults, setRelResults] = useState([]);

  const typeIcon = (t) => (TYPE_ICON[t] || '☑️');
  const assigneeName = (uid) => members.find((m) => m.user_id === uid)?.full_name;
  const assigneeMember = (uid) => members.find((m) => m.user_id === uid);

  // Inline relationship picker for a card's relationship custom field (link tasks
  // without opening the task detail).
  const openRelPicker = (task, field, e) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setCardMenu(null); setAssignFor(null); setPicker(null); setRelQuery('');
    setRelFor((cur) => (cur?.taskId === task._id && cur?.field?._id === field._id ? null
      : { taskId: task._id, field, x: r.right, y: r.bottom + 6 }));
  };
  useEffect(() => {
    if (!relFor) { setRelResults([]); return undefined; }
    const cfg = relFor.field.config || {};
    const ownerList = relFor.field.list_id ? String(relFor.field.list_id) : null;   // List where the field lives
    const targetList = cfg.related_to === 'list' && cfg.list_id ? String(cfg.list_id) : null; // "Related to" List
    // On the TARGET list, link tasks from the OWNING List; on the owning list, link
    // tasks from the target List. (A List field always links the OTHER end.)
    let scope;
    if (targetList && String(listId) === targetList && ownerList) scope = { list_id: ownerList };
    else if (targetList) scope = { list_id: targetList };
    else scope = { project_id: projectId };
    const h = setTimeout(() => {
      tasksApi.list({ ...scope, search: relQuery, limit: 30 }).then((r) => setRelResults(r.items || [])).catch(() => setRelResults([]));
    }, 150);
    return () => clearTimeout(h);
  }, [relFor, relQuery, listId, projectId]);
  const toggleRel = async (taskId, field, linkedId) => {
    const task = board.find((t) => t._id === taskId);
    if (!task) return;
    const cur = (task.custom_fields || {})[field._id];
    const arr = Array.isArray(cur) ? cur : (cur ? [cur] : []);
    const next = arr.includes(linkedId) ? arr.filter((x) => x !== linkedId) : [...arr, linkedId];
    const nextCf = { ...(task.custom_fields || {}), [field._id]: next };
    setBoard((b) => b.map((t) => (t._id === taskId ? { ...t, custom_fields: nextCf } : t))); // optimistic
    try { await tasksApi.update(taskId, { custom_fields: nextCf }); onChanged(); }
    catch (err) { setError(err.response?.data?.error?.message || 'Could not update'); onChanged(); }
  };

  // Inline assignee picker for an existing card (assigns directly, no task detail).
  const openAssign = (task, e) => {
    e.stopPropagation();
    if (!can('task.assign')) return toast.error("You don't have permission to assign tasks.");
    const r = e.currentTarget.getBoundingClientRect();
    setCardMenu(null); setPicker(null); setAssignQuery('');
    setAssignFor(assignFor?.id === task._id ? null : { id: task._id, x: r.right, y: r.bottom + 6 });
  };
  const chooseAssignee = async (uid) => {
    const id = assignFor?.id;
    setAssignFor(null);
    if (!id) return;
    setBoard((b) => b.map((t) => (t._id === id ? { ...t, assignee_id: uid || null } : t))); // optimistic
    try { await tasksApi.assign(id, uid || null); onChanged(); }
    catch (err) { setError(err.response?.data?.error?.message || 'Could not assign'); onChanged(); }
  };

  const openCardMenu = (task, e) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setCardMenu(cardMenu?.id === task._id ? null : { id: task._id, x: r.right, y: r.bottom + 4 });
  };
  const deleteCard = async (id) => {
    setCardMenu(null);
    if (!can('task.delete')) return toast.error('You do not have permission to perform this action.');
    const task = board.find((t) => t._id === id);
    const ok = await confirm({
      title: `Delete: ${task?.title || 'task'}`,
      message: 'This task will be permanently deleted. This cannot be undone.',
    });
    if (!ok) return;
    try { await tasksApi.remove(id); toast.success('Task deleted'); onChanged(); }
    catch (err) { setError(err.response?.data?.error?.message || 'Could not delete task'); }
  };

  const canCreate = can('task.create') && !!projectId;
  const byStatus = (st) => board.filter((t) => t.status === st);
  const draggedTask = dragId ? board.find((t) => t._id === dragId) : null;
  const typeOpt = TYPE_OPTIONS.find((t) => t.value === type) || TYPE_OPTIONS[1];
  const assignee = members.find((m) => m.user_id === assigneeId);
  const assigneeLabel = assignee?.full_name || '';

  const resetComposer = () => {
    setTitle(''); setType('task'); setDueDate(''); setAssigneeId(''); setPicker(null);
  };
  const openComposer = (st) => { setComposerStatus(st); setError(null); resetComposer(); };
  const closeComposer = () => { setComposerStatus(null); resetComposer(); };

  const openPick = (name, e) => {
    e.stopPropagation();
    if (picker?.name === name) { setPicker(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    setMemberQuery('');
    setPicker({ name, x: r.left, y: r.bottom + 4 });
  };

  const onDrop = async (status) => {
    const id = dragId;
    setDragId(null);
    setDragOverCol(null);
    setError(null);
    const task = board.find((t) => t._id === id);
    if (!task || task.status === status) return;
    // Optimistic: move the card instantly so there's no perceived lag, then
    // persist in the background. Revert if the server rejects it.
    const prev = board;
    setBoard((b) => b.map((t) => (t._id === id ? { ...t, status } : t)));
    try {
      // ClickUp-style: tasks move freely between any of the space's statuses.
      // _silent so the global loader doesn't flash, and we DON'T refetch — the
      // optimistic move already reflects the change, so the board never blinks /
      // re-renders the whole page on drop. (Cache is cleared by the mutation, so
      // counts self-heal on the next load/navigation.)
      await tasksApi.changeStatus(id, { to_status: status }, { _silent: true });
    } catch (err) {
      setBoard(prev); // roll back the optimistic move
      setError(err.response?.data?.error?.message || 'Could not move task');
    }
  };

  const submitCreate = async (st) => {
    const value = title.trim();
    if (!value) return;
    setSaving(true); setPicker(null);
    try {
      await tasksApi.create({
        project_id: projectId, list_id: listId, title: value, status: st, type,
        // The composer's date is the task's end/due date (shown as "End date" in detail).
        end_date: dueDate || null, due_date: dueDate || null, assignee_id: assigneeId || null,
      });
      setTitle(''); // keep type/date/assignee for rapid entry, like Jira
      onChanged();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not create task');
    } finally { setSaving(false); }
  };

  const onComposerKey = (e, st) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitCreate(st); }
    if (e.key === 'Escape') closeComposer();
  };

  const filteredMembers = memberQuery.trim()
    ? members.filter((m) => (m.full_name || '').toLowerCase().includes(memberQuery.trim().toLowerCase())
        || (m.email || '').toLowerCase().includes(memberQuery.trim().toLowerCase()))
    : members;

  return (
    <div style={s.wrap}>
      {error && <p style={{ color: '#991b1b' }}>{error}</p>}
      <div style={s.board}>
        {columns.map((col) => {
          const st = col.key;
          // Soft tint of the status color layered over the themed column surface,
          // so columns stay visible boxes in both light and dark mode.
          const bg = `linear-gradient(${col.color}14, ${col.color}14), var(--c-surface-3)`;
          return (
          <div key={st} className="wg-col"
            style={{ background: bg, ...(dragId && dragOverCol === st ? s.colDropTarget : {}) }}
            onDragOver={(e) => { e.preventDefault(); if (dragOverCol !== st) setDragOverCol(st); }}
            onDrop={() => onDrop(st)}>
            <div className="wg-col-head" style={{ background: bg }}>
              <span style={{ ...s.statusPill, background: col.color }}>
                {['done', 'closed'].includes(col.group)
                  ? <span style={s.pillGlyph}>✓</span>
                  : <span style={{ ...s.pillRing, borderColor: 'rgba(255,255,255,.85)' }} />}
                {col.name}
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ ...s.count, color: col.color }}>{byStatus(st).length}</span>
            </div>
            <div className="wg-col-body">
              {byStatus(st).map((t) => {
                const subCount = board.filter((x) => x.parent_id === t._id).length;
                return (
                <div key={t._id} className="wg-card"
                  draggable onDragStart={() => setDragId(t._id)}
                  onDragEnd={() => { setDragId(null); setDragOverCol(null); }}
                  style={dragId === t._id ? s.cardDragging : undefined}
                  onClick={() => open(t._id)}>
                  <div style={s.cardTop}>
                    <CardTitle style={s.cardTitle} text={t.title} />
                    <button className="icon-btn wg-quick" title="Actions" onClick={(e) => openCardMenu(t, e)}>⋯</button>
                  </div>

                  <div style={s.chipsRow}>
                    {cfv.status && (() => { const st2 = statuses.find((x) => x.key === t.status) || { name: t.status, color: '#6b7280' };
                      return <span data-tip="Status" style={{ ...s.statusChip, color: st2.color, background: `${st2.color}1a` }}>{st2.name}</span>; })()}
                    {cfv.priority && <span data-tip="Priority" style={{ ...s.priChip, color: PRIORITY_COLOR[t.priority], background: `${PRIORITY_COLOR[t.priority]}1a` }}>
                      <span style={{ ...s.priDot, background: PRIORITY_COLOR[t.priority] }} />{t.priority}
                    </span>}
                    {cfv.type && <span style={s.metaChip} data-tip="Task type"><TaskTypeIcon type={t.type} size={12} /> {(t.type || 'task').charAt(0).toUpperCase() + (t.type || 'task').slice(1)}</span>}
                    {/* Dates in order: created · due. Calendar icon + hover tooltip. */}
                    {cfv.created_at && <span style={s.metaChip} data-tip="Date created (read-only)"><IconCalendar size={12} />{t.created_at && shortDate(t.created_at)}</span>}
                    {cfv.due_date && <span style={s.metaChip} data-tip="Due date"><IconCalendar size={12} />{t.due_date && shortDate(t.due_date)}</span>}
                    {cfv.closed_at && (() => {
                      const cd = t.completed_at || t.closed_at || (isDoneStatus(statuses, t.status) ? t.updated_at : null);
                      return <span style={s.metaChip} data-tip="Date closed (read-only)"><IconCalendar size={12} />{cd && shortDate(cd)}</span>;
                    })()}
                    {cfv.labels && (t.labels || []).slice(0, 3).map((l) => <span key={l} data-tip="Label" style={s.labelChip}>{l}</span>)}
                    {cardCustom.map((f) => {
                      const val = (t.custom_fields || {})[f._id];
                      // Relationship: same icon with/without value, clickable to link inline.
                      if (f.type === 'relationship') {
                        const n = relCount(val);
                        return (
                          <button key={f._id} style={{ ...s.cfRelChip, ...(n ? {} : { color: 'var(--c-faint)' }) }}
                            data-tip={f.name} onClick={(e) => openRelPicker(t, f, e)}>
                            <IconFieldRelationship size={12} />{n > 0 ? n : ''}
                          </button>
                        );
                      }
                      return renderCustomChip(f, val);
                    })}
                  </div>

                  <div style={s.cardBottom}>
                    <span style={s.idRow}>
                      {cfv.key && (
                        <>
                          <span data-tip="Task type" style={{ display: 'inline-flex', color: '#6b7280' }}><TaskTypeIcon type={t.type} size={14} /></span>
                          <span data-tip="Task ID" style={s.key}>{t.key}</span>
                        </>
                      )}
                    </span>
                    {cfv.assignee && (t.assignee_id
                      ? (() => {
                        const m = assigneeMember(t.assignee_id);
                        return (
                          <button style={{ ...s.cardAvatar, background: m?.avatar_color || s.cardAvatar.background, cursor: 'pointer', border: 'none', overflow: 'hidden' }}
                            title={m?.full_name || 'Assignee'} onClick={(e) => openAssign(t, e)}>
                            {m?.avatar_url
                              ? <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : initials(m?.full_name || '?')}
                          </button>
                        );
                      })()
                      : <button style={{ ...s.cardAvatarEmpty, cursor: 'pointer' }} title="Assign" onClick={(e) => openAssign(t, e)}>+</button>)}
                  </div>
                </div>
                );
              })}

              {/* ClickUp-style drop placeholder: shows where the card will land. */}
              {draggedTask && dragOverCol === st && draggedTask.status !== st && (
                <div style={s.placeholder}>Drop here</div>
              )}

              {canCreate && (composerStatus === st ? (
                <div style={s.composer} onClick={(e) => e.stopPropagation()}>
                  <div style={s.composerTop}>
                    <button style={s.composerClose} title="Close (Esc)" onClick={closeComposer}>✕</button>
                  </div>
                  <textarea autoFocus style={s.composerInput} rows={2}
                    placeholder="What needs to be done?" value={title}
                    onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => onComposerKey(e, st)} />

                  <div style={s.composerBar}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button style={s.tbtn} title={`Type: ${typeOpt.label}`} onClick={(e) => openPick('type', e)}>
                        <span style={s.tbtnIcon}><TaskTypeIcon type={typeOpt.value} size={14} /></span> <IconChevronDown size={13} />
                      </button>

                      <label style={s.dateBtn} title="Due date">
                        <IconCalendar size={15} />{dueDate && <span style={{ marginLeft: 5 }}>{shortDate(dueDate)}</span>}
                        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={s.dateInput} />
                      </label>

                      <button style={s.tbtn} title={assigneeLabel || 'Assignee'} onClick={(e) => openPick('assignee', e)}>
                        {assigneeLabel ? <span style={{ ...s.miniAvatar, background: assignee?.avatar_color || s.miniAvatar.background, overflow: 'hidden' }}>{assignee?.avatar_url ? <img src={assignee.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(assigneeLabel)}</span> : <IconUser size={15} />}
                      </button>
                    </div>

                    <button style={{ ...s.enterBtn, ...((saving || !title.trim()) ? s.enterBtnOff : {}) }}
                      disabled={saving || !title.trim()}
                      onClick={() => submitCreate(st)} title="Create (Enter)">
                      <IconEnter size={14} /> Add
                    </button>
                  </div>
                </div>
              ) : (
                <button className="icon-btn" style={s.createBtn} onClick={() => openComposer(st)}>+ Create</button>
              ))}
            </div>
          </div>
          );
        })}
      </div>

      {/* Card actions menu (fixed; escapes board clipping) */}
      {cardMenu && (
        <>
          <div style={s.pickBackdrop} onClick={() => setCardMenu(null)} />
          <div style={{ ...s.popFixed, top: cardMenu.y, left: cardMenu.x - 176, minWidth: 176, borderRadius: 12, padding: 6 }}>
            <button className="wg-menu-item" style={s.menuItem} onClick={() => { const id = cardMenu.id; setCardMenu(null); open(id); }}>
              <span style={s.menuIcon}><IconExpand size={15} /></span> Open
            </button>
            <div style={s.menuDivider} />
            <button className="wg-menu-item" title={can('task.delete') ? '' : 'You do not have permission to perform this action.'}
              style={{ ...s.menuItem, color: '#dc2626', ...(can('task.delete') ? {} : { opacity: 0.5, cursor: 'not-allowed' }) }}
              onClick={() => deleteCard(cardMenu.id)}>
              <span style={{ ...s.menuIcon, color: '#dc2626' }}><IconTrash size={15} /></span> Delete
            </button>
          </div>
        </>
      )}

      {/* Inline assignee picker for an existing card (assigns on select) */}
      {assignFor && (() => {
        const cur = board.find((t) => t._id === assignFor.id);
        const q = assignQuery.trim().toLowerCase();
        const list = members.filter((m) => !q
          || (m.full_name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q));
        return (
          <>
            <div style={s.pickBackdrop} onClick={() => setAssignFor(null)} />
            <div style={{ ...s.popFixed, top: assignFor.y, left: Math.max(8, assignFor.x - 240), width: 240 }} onClick={(e) => e.stopPropagation()}>
              <input autoFocus style={s.popSearch} placeholder="Search or enter email…"
                value={assignQuery} onChange={(e) => setAssignQuery(e.target.value)} />
              <button style={s.popItem} onClick={() => chooseAssignee('')}>👤 Unassigned</button>
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {list.map((m) => (
                  <button key={m.user_id} style={s.popItem} onClick={() => chooseAssignee(m.user_id)}>
                    <span style={{ ...s.miniAvatar, background: m.avatar_color || s.miniAvatar.background, overflow: 'hidden' }}>{m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(m.full_name)}</span>
                    <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <span>{m.full_name}{m.user_id === me ? ' (you)' : ''}</span>
                      {m.email && <span style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</span>}
                    </span>
                    {cur?.assignee_id === m.user_id && <span style={{ marginLeft: 'auto', color: 'var(--c-primary)' }}>✓</span>}
                  </button>
                ))}
                {list.length === 0 && <div style={s.popEmpty}>No matching member.</div>}
              </div>
            </div>
          </>
        );
      })()}

      {/* Inline relationship picker for a card's relationship field (links on select) */}
      {relFor && (() => {
        const task = board.find((t) => t._id === relFor.taskId);
        const cur = (task?.custom_fields || {})[relFor.field._id];
        const linked = Array.isArray(cur) ? cur : (cur ? [cur] : []);
        const items = relResults.filter((r) => r._id !== relFor.taskId);
        return (
          <>
            <div style={s.pickBackdrop} onClick={() => setRelFor(null)} />
            <div style={{ ...s.popFixed, top: relFor.y, left: Math.max(8, relFor.x - 260), width: 260 }} onClick={(e) => e.stopPropagation()}>
              <input autoFocus style={s.popSearch} placeholder={`Link to ${relFor.field.name}…`}
                value={relQuery} onChange={(e) => setRelQuery(e.target.value)} />
              <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 4 }}>
                {items.length === 0 && <div style={s.popEmpty}>No tasks found</div>}
                {items.map((r) => (
                  <button key={r._id} style={s.popItem} onClick={() => toggleRel(relFor.taskId, relFor.field, r._id)}>
                    <span style={s.relKey}>{r.key}</span>
                    <span style={{ flex: 1, minWidth: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                    {linked.includes(r._id) && <span style={{ marginLeft: 'auto', color: 'var(--c-primary)' }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </>
        );
      })()}

      {/* Fixed-positioned pickers (escape board clipping; no overlap) */}
      {picker && (
        <>
          <div style={s.pickBackdrop} onClick={() => setPicker(null)} />
          <div style={{ ...s.popFixed, top: picker.y, left: picker.x }} onClick={(e) => e.stopPropagation()}>
            {picker.name === 'type' && TYPE_OPTIONS.map((o) => (
              <button key={o.value} style={s.popItem} onClick={() => { setType(o.value); setPicker(null); }}>
                <span style={{ display: 'inline-flex' }}><TaskTypeIcon type={o.value} size={15} /></span> {o.label}
              </button>
            ))}

            {picker.name === 'assignee' && (
              <>
                <input autoFocus style={s.popSearch} placeholder="Search members by name or email…"
                  value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} />
                <button style={s.popItem}
                  onClick={() => { setAssigneeId(''); setPicker(null); }}>👤 Unassigned</button>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {filteredMembers.map((m) => (
                    <button key={m.user_id} style={s.popItem}
                      onClick={() => { setAssigneeId(m.user_id); setPicker(null); }}>
                      <span style={{ ...s.miniAvatar, background: m.avatar_color || s.miniAvatar.background, overflow: 'hidden' }}>{m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(m.full_name)}</span>
                      <span style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{m.full_name}{m.user_id === me ? ' (you)' : ''}</span>
                        {m.email && <span style={{ fontSize: 11, color: '#6b7280' }}>{m.email}</span>}
                      </span>
                    </button>
                  ))}
                  {filteredMembers.length === 0 && (
                    <div style={s.popEmpty}>No matching member. Add people to the space in the Members tab.</div>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const s = {
  // Wrapper fills the view area so the board (and its columns' max-height) get a real height.
  wrap: { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' },
  board: { flex: 1, minHeight: 0, display: 'flex', gap: 16, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 8, alignItems: 'flex-start' },
  // Drop-target column: a soft ring (the placeholder card is the main cue).
  colDropTarget: { boxShadow: 'inset 0 0 0 2px var(--c-faint)' },
  // The card being dragged is dimmed so the landing placeholder reads clearly.
  cardDragging: { opacity: 0.4 },
  // ClickUp-style "drop here" ghost card shown in the target column while dragging.
  placeholder: { height: 60, border: '2px dashed var(--c-border)', borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--c-faint)', fontSize: 12.5, fontWeight: 600, letterSpacing: '.02em',
    background: 'var(--c-hover)', animation: 'wg-pop 120ms ease' },
  statusDot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  statusPill: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 11px', borderRadius: 6,
    color: '#fff', fontSize: 11.5, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', whiteSpace: 'nowrap' },
  pillGlyph: { fontSize: 11, fontWeight: 900, lineHeight: 1 },
  pillRing: { width: 10, height: 10, borderRadius: '50%', border: '2px solid', flexShrink: 0 },
  count: { background: 'transparent', borderRadius: 999, padding: '1px 4px', fontWeight: 800, fontSize: 13 },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: 'var(--c-text)', display: '-webkit-box',
    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  chipsRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 },
  priChip: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
    textTransform: 'capitalize', borderRadius: 999, padding: '2px 9px' },
  statusChip: { display: 'inline-flex', alignItems: 'center', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '.02em', borderRadius: 6, padding: '2px 8px' },
  priDot: { width: 7, height: 7, borderRadius: 999 },
  metaChip: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
    color: 'var(--c-muted)', background: 'var(--c-surface-3)', borderRadius: 999, padding: '2px 8px' },
  labelChip: { fontSize: 11, fontWeight: 600, background: 'var(--c-surface-3)', color: 'var(--c-text)', borderRadius: 999, padding: '2px 8px' },
  cardBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  idRow: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  cardAvatar: { width: 26, height: 26, borderRadius: '50%', background: '#f59e0b', color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 },
  cardAvatarEmpty: { width: 26, height: 26, borderRadius: '50%', background: 'var(--c-surface)', border: '1.5px dashed var(--c-border)',
    color: 'var(--c-faint)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 },
  key: { fontWeight: 700, color: 'var(--c-text-strong)', fontSize: 12, letterSpacing: '.02em' },
  createBtn: { display: 'flex', alignItems: 'center', gap: 6, width: '100%', boxSizing: 'border-box',
    padding: '9px 12px', border: 'none', color: 'var(--c-muted)', cursor: 'pointer',
    borderRadius: 8, fontSize: 13, fontWeight: 600, textAlign: 'left', marginTop: 2 },
  menuItem: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box', textAlign: 'left',
    border: 'none', padding: '9px 11px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: 'var(--c-text)' },
  menuIcon: { display: 'inline-flex', color: 'var(--c-muted)' },
  menuDivider: { height: 1, background: 'var(--c-border-2)', margin: '5px 0' },
  composer: { background: 'var(--c-surface)', border: '2px solid var(--c-text-strong)', borderRadius: 10, padding: 10 },
  composerTop: { display: 'flex', justifyContent: 'flex-end', marginBottom: 2 },
  composerClose: { background: 'none', border: 'none', color: 'var(--c-faint)', cursor: 'pointer', fontSize: 13, padding: 2 },
  composerInput: { width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none',
    resize: 'none', fontSize: 14, fontFamily: 'inherit', background: 'transparent', color: 'var(--c-text)' },
  composerBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', gap: 6 },
  tbtn: { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--c-surface)', border: '1px solid var(--c-border)',
    borderRadius: 7, padding: '5px 8px', cursor: 'pointer', fontSize: 13, color: 'var(--c-muted)' },
  tbtnIcon: { display: 'inline-flex', fontSize: 14, lineHeight: 1 },
  dateBtn: { display: 'inline-flex', alignItems: 'center', background: 'var(--c-surface)', border: '1px solid var(--c-border)',
    borderRadius: 7, padding: '5px 8px', cursor: 'pointer', fontSize: 13, color: 'var(--c-muted)', position: 'relative', overflow: 'hidden' },
  dateInput: { position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' },
  miniAvatar: { width: 18, height: 18, borderRadius: '50%', background: '#f59e0b', color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 },
  cancelBtn: { background: 'none', border: '1px solid var(--c-border)', borderRadius: 6, padding: '2px 10px',
    cursor: 'pointer', color: 'var(--c-muted)', fontSize: 13 },
  enterBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--c-primary)', border: 'none',
    borderRadius: 7, padding: '6px 12px', cursor: 'pointer', color: 'var(--c-on-primary)', fontSize: 13, fontWeight: 600 },
  enterBtnOff: { background: 'var(--c-hover)', color: 'var(--c-faint)', cursor: 'not-allowed' },
  // Fixed pickers
  pickBackdrop: { position: 'fixed', inset: 0, zIndex: 400 },
  popFixed: { position: 'fixed', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8,
    boxShadow: '0 12px 32px rgba(0,0,0,.2)', zIndex: 401, minWidth: 200, padding: 4, color: 'var(--c-text)' },
  cfRelChip: { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, borderRadius: 6,
    padding: '3px 7px', background: 'var(--c-surface-2)', color: 'var(--c-muted)', border: 'none', cursor: 'pointer' },
  relKey: { color: '#4f46e5', fontWeight: 700, fontSize: 12, flexShrink: 0 },
  popSearch: { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--c-border)',
    borderRadius: 6, fontSize: 14, marginBottom: 4, background: 'var(--c-surface)', color: 'var(--c-text)' },
  popItem: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
    background: 'none', border: 'none', padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 14, color: 'var(--c-text)' },
  popEmpty: { padding: '8px 10px', color: 'var(--c-muted)', fontSize: 13 },
};

// Memoized: the board only re-renders when its props actually change (tasks,
// members, statuses, handlers), not on every parent state update.
export default memo(KanbanBoard);
