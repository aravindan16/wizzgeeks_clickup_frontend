import { useCallback, useEffect, useRef, useState } from 'react';
import {
  tasksApi, STATUS_LABELS, PRIORITIES, LINK_TYPES, LINK_LABELS,
  resolveStatuses, statusLabel,
} from './tasksApi';
import { projectsApi } from '../projects/projectsApi';
import { customFieldsApi } from '../customfields/customFieldsApi';
import CustomFieldValue from '../customfields/CustomFieldValue';
import LabelPicker from '../labels/LabelPicker';
import TaskTypeIcon from '../../components/TaskTypeIcon';
import Select from '../../components/Select';
import { useAuth } from '../auth/useAuth';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { IconFieldDropdown, IconFieldText, IconFieldRelationship, IconArrowLeft } from '../../components/icons';
import { beginSilent, endSilent } from '../../services/apiClient';

const FIELD_CMP = { dropdown: IconFieldDropdown, relationship: IconFieldRelationship, text: IconFieldText };

const initials = (n) => (n || '?').split(/[\s@.]+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const timeAgo = (d) => {
  if (!d) return '';
  const sec = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (sec < 60) return 'just now';
  const m = Math.floor(sec / 60); if (m < 60) return `${m} minute${m > 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const days = Math.floor(h / 24); if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  const w = Math.floor(days / 7); if (w < 5) return `${w} week${w > 1 ? 's' : ''} ago`;
  const mo = Math.floor(days / 30); if (mo < 12) return `${mo} month${mo > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 365)} year${days >= 730 ? 's' : ''} ago`;
};

const fmtDate = (d) => (d ? new Date(d).toLocaleString(undefined, {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '');

const DONE = new Set(['completed', 'closed']);
const typeIcon = (t) => <span style={{ display: 'inline-flex', color: 'var(--c-muted)', verticalAlign: 'middle' }}><TaskTypeIcon type={t} size={15} /></span>;

/**
 * Reusable task (issue) detail. Rendered both inside a modal (from the board/list)
 * and as a full page (deep-link route). `onClose` returns the user to where they were;
 * `onChanged` lets the parent (board/list) refresh after edits; `onOpenTask` swaps the
 * open issue (used by subtasks / linked items).
 */
export default function TaskDetail({ taskId, onClose, onChanged, members: membersProp, statuses: statusesProp, onOpenTask, inModal = false }) {
  const { user, can } = useAuth();
  const canEdit = can('task.update');
  const canAssign = can('task.assign');
  const canComment = can('task.comment');
  const toast = useToast();
  const NO_PERM = "You don't have permission to edit this task.";
  const confirm = useConfirm();
  const me = user?._id || user?.id;

  const [task, setTask] = useState(null);
  const [fetchedProject, setFetchedProject] = useState(null);
  const [fetchedMembers, setFetchedMembers] = useState([]);
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [links, setLinks] = useState([]);
  const [siblings, setSiblings] = useState([]); // candidate tasks for linking
  const [customFields, setCustomFields] = useState([]);
  const [fieldValues, setFieldValues] = useState({});
  const [error, setError] = useState(null);

  // Prefer members passed from the board (already loaded); fetch only as fallback.
  const members = (membersProp && membersProp.length) ? membersProp : fetchedMembers;

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descVal, setDescVal] = useState('');
  const descTimer = useRef(null); // debounce timer for description auto-save
  const [labelsVal, setLabelsVal] = useState('');
  const [newComment, setNewComment] = useState('');
  const [editingComment, setEditingComment] = useState(null);

  const [activityTab, setActivityTab] = useState('all'); // all | comments | history
  const [visibleCount, setVisibleCount] = useState(10);  // "Show more" paging for All/History

  const [addingSub, setAddingSub] = useState(false);
  const [newSub, setNewSub] = useState('');
  const [addingLink, setAddingLink] = useState(false);
  const [linkType, setLinkType] = useState('relates_to');
  const [linkTarget, setLinkTarget] = useState('');

  const load = useCallback(async () => {
    // Silent: this whole batch (opening the panel, or refreshing after an action)
    // must NOT flash the global loading overlay over the page behind the modal.
    beginSilent();
    try {
      const t = await tasksApi.get(taskId);
      setTask(t);
      setTitleVal(t.title); setDescVal(t.description || ''); setLabelsVal((t.labels || []).join(', '));
      setFieldValues(t.custom_fields || {});
      const [ms, cs, act, subs, lks, sibs, proj, cf] = await Promise.all([
        projectsApi.members(t.project_id).catch(() => []),
        tasksApi.comments(taskId).catch(() => []),
        tasksApi.activity(taskId).catch(() => []),
        tasksApi.subtasks(taskId).catch(() => []),
        tasksApi.links(taskId).catch(() => []),
        tasksApi.list({ project_id: t.project_id, limit: 200 }).then((r) => r.items || []).catch(() => []),
        statusesProp?.length ? Promise.resolve(null) : projectsApi.get(t.project_id).catch(() => null),
        customFieldsApi.list(t.project_id, t.list_id, t._id).catch(() => []),
      ]);
      setFetchedMembers(ms); setComments(cs); setActivity(act);
      setSubtasks(subs); setLinks(lks); setSiblings(sibs); setFetchedProject(proj);
      // Hide inherited Space fields disabled for this List.
      setCustomFields((cf || []).filter((f) => f.enabled !== false));
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load task');
    } finally {
      endSilent();
    }
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  if (error) return (
    <div style={{ padding: 24 }}>
      <button className="wg-back" style={s.back} onClick={onClose}><IconArrowLeft size={15} /> Back to board</button>
      <div style={{ marginTop: 16, color: 'var(--c-text-strong)', fontWeight: 600, fontSize: 15 }}>{error}</div>
      <div style={{ marginTop: 6, color: 'var(--c-muted)', fontSize: 13.5 }}>
        You may not have permission for this. Ask an admin to grant it, or go back.
      </div>
    </div>
  );
  if (!task) return <p style={{ padding: 20 }}>Loading…</p>;

  const nameOf = (uid) => members.find((m) => m.user_id === uid)?.full_name;
  const meIsMember = members.some((m) => m.user_id === me);
  // The space's full workflow; a task can move to any status (ClickUp-style).
  const spaceStatuses = (statusesProp && statusesProp.length) ? statusesProp : resolveStatuses(fetchedProject);
  const statusList = spaceStatuses.some((st) => st.key === task.status)
    ? spaceStatuses
    : [...spaceStatuses, { key: task.status, name: task.status, color: '#6b7280' }];

  const after = async () => { await load(); onChanged?.(); };
  // A field edit only changes the task + adds an activity entry, so after saving we
  // optimistically update, then SILENTLY refresh just the activity feed (no loader,
  // no refetching members/subtasks/links/custom-fields — that caused the flicker
  // and a burst of requests on a simple assignee/status change).
  const refreshActivity = () => tasksApi.activity(taskId, { _silent: true }).then(setActivity).catch(() => {});
  const save = async (patch, opts) => {
    if (!canEdit) { toast.error(NO_PERM); return; }
    setTask((t) => ({ ...t, ...patch }));
    try { await tasksApi.update(taskId, patch, { _silent: true, ...opts }); onChanged?.(); refreshActivity(); }
    catch (err) { toast.error(err.response?.data?.error?.message || NO_PERM); load(); }
  };

  // Description auto-saves silently (no loader): debounced while typing + on blur.
  // Doesn't reload the task (that would reset the textarea mid-edit) — just an
  // optimistic update + a background refresh of the parent board.
  const saveDesc = (val) => {
    if (val === (task.description || '')) return;
    if (!canEdit) { toast.error(NO_PERM); setDescVal(task.description || ''); return; }
    setTask((t) => ({ ...t, description: val }));
    // Fully background: no loader, and no onChanged() board refresh (the description
    // isn't shown on board cards) — so typing never triggers the global loader.
    tasksApi.update(taskId, { description: val }, { _silent: true })
      .catch((err) => { toast.error(err.response?.data?.error?.message || NO_PERM); load(); });
  };
  const onDescChange = (e) => {
    const v = e.target.value;
    setDescVal(v);
    clearTimeout(descTimer.current);
    descTimer.current = setTimeout(() => saveDesc(v), 700);
  };
  const onDescBlur = () => { clearTimeout(descTimer.current); setEditingDesc(false); saveDesc(descVal); };

  const move = async (to) => {
    if (to === task.status) return;
    setTask((t) => ({ ...t, status: to })); // optimistic
    try { await tasksApi.changeStatus(taskId, { to_status: to }, { _silent: true }); onChanged?.(); refreshActivity(); }
    catch (err) { toast.error(err.response?.data?.error?.message || 'Could not change status'); load(); }
  };
  const assign = async (uid) => {
    if (!canAssign) { toast.error("You don't have permission to assign tasks."); return; }
    setTask((t) => ({ ...t, assignee_id: uid || null })); // optimistic
    try { await tasksApi.assign(taskId, uid || null, { _silent: true }); onChanged?.(); refreshActivity(); }
    catch (err) { toast.error(err.response?.data?.error?.message || 'Assign failed'); load(); }
  };
  // Comment actions only refresh the comment list (not the whole task) — no need
  // to refetch members/subtasks/links/etc. on every comment.
  const refreshComments = () => tasksApi.comments(taskId).then(setComments).catch(() => {});
  const addComment = async (e) => { e.preventDefault(); if (!newComment.trim()) return; await tasksApi.addComment(taskId, newComment); setNewComment(''); refreshComments(); onChanged?.(); };
  const saveEdit = async (cid) => { await tasksApi.editComment(cid, editingComment.body); setEditingComment(null); refreshComments(); };
  const delComment = async (cid) => {
    const ok = await confirm({ title: 'Delete comment', message: 'This comment will be deleted. This cannot be undone.' });
    if (ok) { await tasksApi.deleteComment(cid); refreshComments(); onChanged?.(); }
  };

  const addSubtask = async (e) => {
    e.preventDefault();
    if (!newSub.trim()) return;
    try {
      // Append the created subtask instead of reloading the whole task (that fired
      // ~12 requests for members/comments/links/custom-fields/etc.).
      const created = await tasksApi.create({ project_id: task.project_id, title: newSub.trim(), type: 'subtask', parent_id: taskId });
      setSubtasks((arr) => [...arr, created]);
      setNewSub(''); setAddingSub(false);
      onChanged?.(); refreshActivity();
    } catch (err) { toast.error(err.response?.data?.error?.message || 'Could not add subtask'); }
  };
  const removeSubtask = async (id, e) => {
    e.stopPropagation();
    const ok = await confirm({ title: 'Remove subtask', message: 'This subtask will be deleted. This cannot be undone.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try { await tasksApi.remove(id); setSubtasks((arr) => arr.filter((x) => x._id !== id)); onChanged?.(); }
    catch (err) { toast.error(err.response?.data?.error?.message || 'Could not remove subtask'); }
  };

  const addLink = async () => {
    if (!linkTarget) return;
    try {
      const updated = await tasksApi.addLink(taskId, linkTarget, linkType);
      setLinks(updated); setLinkTarget(''); setAddingLink(false); onChanged?.();
    } catch (err) { setError(err.response?.data?.error?.message || 'Could not add link'); }
  };
  const removeLink = async (target) => {
    const updated = await tasksApi.removeLink(taskId, target);
    setLinks(updated); onChanged?.();
  };

  const openTask = (id) => { if (onOpenTask) onOpenTask(id); };

  const setFieldVal = async (id, v) => {
    const next = { ...fieldValues, [id]: v };
    setFieldValues(next);
    // Silent (no loader) + refresh only the activity feed — a custom-field change
    // shouldn't refetch the whole task or flash the loader.
    try { await tasksApi.update(taskId, { custom_fields: next }, { _silent: true }); onChanged?.(); refreshActivity(); }
    catch (err) { toast.error(err.response?.data?.error?.message || 'Could not save field'); load(); }
  };

  // already-linked ids + self are not candidates for a new link
  const linkedIds = new Set([taskId, ...links.map((l) => l.task_id)]);
  const linkCandidates = siblings.filter((s) => !linkedIds.has(s._id));
  const subDone = subtasks.filter((s) => DONE.has(s.status)).length;

  // merged "All" activity feed (comments + audit events), newest first
  const feed = [
    ...comments.map((c) => ({ kind: 'comment', at: c.created_at, data: c })),
    ...activity.map((a) => ({ kind: 'activity', at: a.created_at, data: a })),
  ].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

  return (
    <div style={inModal ? s.rootModal : undefined}>
      <div style={inModal ? s.headerModal : s.header}>
        <div style={s.breadcrumb}>
          <button className="wg-back" style={s.back} onClick={onClose}>
            <IconArrowLeft size={15} /> Board
          </button>
          <span style={s.crumbSep}>/</span>
          <span style={s.keyCrumb}>{typeIcon(task.type)} {task.key}</span>
        </div>
        <button style={s.closeBtn} title="Close" onClick={onClose}>✕</button>
      </div>

      <div style={inModal ? s.scrollBody : undefined}>
      {!canEdit && (
        <div style={s.readOnlyBar}>
          <span style={s.readOnlyIcon}>🔒</span>
          <span><b>View only</b> — you don’t have permission to edit this task.</span>
        </div>
      )}
      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div style={s.grid}>
        {/* MAIN */}
        <div>
          {editingTitle ? (
            <input autoFocus style={s.titleInput} value={titleVal}
              onChange={(e) => setTitleVal(e.target.value)}
              onBlur={() => { setEditingTitle(false); if (titleVal.trim() && titleVal !== task.title) save({ title: titleVal.trim() }); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />
          ) : (
            <h1 className={canEdit ? 'wg-editable-title' : undefined} style={{ ...s.title, cursor: canEdit ? 'text' : 'default' }} onClick={() => canEdit && setEditingTitle(true)} title={canEdit ? 'Click to edit' : ''}>{task.title}</h1>
          )}

          <div style={s.section}>
            <div style={s.label}>Description</div>
            {editingDesc ? (
              <textarea autoFocus style={s.descArea} value={descVal} onChange={onDescChange} onBlur={onDescBlur} />
            ) : (
              <div style={{ ...s.descBox, cursor: canEdit ? 'text' : 'default' }}
                onClick={() => canEdit && setEditingDesc(true)}>
                {task.description || <span style={{ color: 'var(--c-faint)' }}>{canEdit ? 'Add a description…' : 'No description'}</span>}
              </div>
            )}
          </div>

          {/* SUBTASKS */}
          <div style={s.section}>
            <div style={s.sectionHead}>
              <div style={s.label}>Subtasks</div>
              {subtasks.length > 0 && (
                <div style={s.progressWrap}>
                  <div style={s.progressTrack}><div style={{ ...s.progressFill, width: `${Math.round((subDone / subtasks.length) * 100)}%` }} /></div>
                  <span style={s.progressText}>{subDone}/{subtasks.length} done</span>
                </div>
              )}
            </div>
            {subtasks.map((st) => (
              <div key={st._id} style={s.subRow} onClick={() => openTask(st._id)}>
                <span style={{ flexShrink: 0 }}>{typeIcon(st.type)}</span>
                <span style={s.subKey}>{st.key}</span>
                <span style={{ flex: 1, textDecoration: DONE.has(st.status) ? 'line-through' : 'none', color: DONE.has(st.status) ? 'var(--c-faint)' : 'var(--c-text-strong)' }}>{st.title}</span>
                <StatusBadge status={st.status} statuses={spaceStatuses} />
                {canEdit && <button style={s.linkX} title="Remove subtask" onClick={(e) => removeSubtask(st._id, e)}>✕</button>}
              </div>
            ))}
            {addingSub ? (
              <form onSubmit={addSubtask} style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <input autoFocus style={s.inlineInput} placeholder="What needs to be done?" value={newSub} onChange={(e) => setNewSub(e.target.value)} />
                <button style={s.btn} type="submit">Add</button>
                <button style={s.btnGhost} type="button" onClick={() => { setAddingSub(false); setNewSub(''); }}>Cancel</button>
              </form>
            ) : canEdit ? (
              <button style={s.addLink} onClick={() => setAddingSub(true)}>+ Add subtask</button>
            ) : null}
          </div>

          {/* LINKED WORK ITEMS */}
          <div style={s.section}>
            <div style={s.label}>Linked work items</div>
            {links.map((l) => (
              <div key={l.task_id} style={s.linkRow}>
                <span style={s.linkType}>{LINK_LABELS[l.type] || l.type}</span>
                <span style={s.subRowInner} onClick={() => openTask(l.task_id)}>
                  <span style={{ flexShrink: 0 }}>{typeIcon(l.task_type)}</span>
                  <span style={s.subKey}>{l.key}</span>
                  <span style={{ flex: 1 }}>{l.title}</span>
                  <StatusBadge status={l.status} statuses={spaceStatuses} />
                </span>
                {canEdit && <button style={s.linkX} title="Remove link" onClick={() => removeLink(l.task_id)}>✕</button>}
              </div>
            ))}
            {addingLink ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <Select style={{ minWidth: 130 }} value={linkType} onChange={setLinkType}
                  options={LINK_TYPES.map((lt) => ({ value: lt.value, label: lt.label }))} />
                <Select style={{ flex: 1, minWidth: 180 }} value={linkTarget} onChange={setLinkTarget} placeholder="Select a work item…"
                  options={[{ value: '', label: 'Select a work item…' }, ...linkCandidates.map((c) => ({ value: c._id, label: `${c.key} — ${c.title}` }))]} />
                <button style={s.btn} onClick={addLink} disabled={!linkTarget}>Link</button>
                <button style={s.btnGhost} onClick={() => { setAddingLink(false); setLinkTarget(''); }}>Cancel</button>
              </div>
            ) : canEdit ? (
              <button style={s.addLink} onClick={() => setAddingLink(true)}>+ Add linked work item</button>
            ) : null}
          </div>

          {/* CUSTOM FIELDS */}
          {customFields.length > 0 && (
            <div style={s.section}>
              <div style={s.label}>Custom Fields</div>
              {customFields.map((f) => {
                const Cmp = FIELD_CMP[f.type] || IconFieldText;
                // Relationship fields render as a full-width related-task table (ClickUp-style);
                // dropdown/text stay on a compact inline row.
                if (f.type === 'relationship') {
                  return (
                    <div key={f._id} style={s.cfRelBlock}>
                      <span style={s.cfName}><span style={s.cfIcon}><Cmp size={14} /></span>{f.name}
                        {f.location && <span style={s.cfLoc} title={`List: ${f.location}`}>{f.location}</span>}
                      </span>
                      <div style={{ marginTop: 8, ...(canEdit ? {} : s.readOnlyField) }}>
                        <CustomFieldValue field={f} value={fieldValues[f._id]} onChange={(v) => setFieldVal(f._id, v)}
                          spaceId={task.project_id} onOpenTask={onOpenTask} currentListId={task.list_id} />
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={f._id} style={s.cfRow}>
                    <span style={s.cfName}><span style={s.cfIcon}><Cmp size={14} /></span>{f.name}
                        {f.location && <span style={s.cfLoc} title={`List: ${f.location}`}>{f.location}</span>}
                      </span>
                    <div style={{ flex: 1 }} />
                    <div style={canEdit ? undefined : s.readOnlyField}>
                      <CustomFieldValue field={f} value={fieldValues[f._id]} onChange={(v) => setFieldVal(f._id, v)}
                        spaceId={task.project_id} onOpenTask={onOpenTask} currentListId={task.list_id} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ACTIVITY (tabbed) */}
          <div style={s.section}>
            <div style={s.label}>Activity</div>
            <div style={s.tabs}>
              {[['all', 'All'], ['comments', 'Comments'], ['history', 'History']].map(([k, lbl]) => (
                <button key={k} style={{ ...s.tab, ...(activityTab === k ? s.tabActive : {}) }} onClick={() => { setActivityTab(k); setVisibleCount(10); }}>{lbl}</button>
              ))}
            </div>

            {activityTab === 'comments' && canComment && (
              <form onSubmit={addComment} style={{ margin: '12px 0', display: 'flex', gap: 10 }}>
                <span style={s.avatar}>{initials(user?.full_name)}</span>
                <div style={{ flex: 1 }}>
                  <textarea style={s.descArea} placeholder="Add a comment…" value={newComment} onChange={(e) => setNewComment(e.target.value)} />
                  <button style={s.btn} type="submit">Comment</button>
                </div>
              </form>
            )}
            {activityTab === 'comments' && !canComment && (
              <div style={{ margin: '12px 0', color: 'var(--c-muted)', fontSize: 13 }}>You don’t have permission to comment.</div>
            )}

            {activityTab === 'comments' && (
              <div>
                {comments.length === 0 && <Empty text="No comments yet." />}
                {comments.map((c) => (
                  <CommentRow key={c._id} c={c} me={me} editingComment={editingComment} setEditingComment={setEditingComment}
                    saveEdit={saveEdit} delComment={delComment} />
                ))}
              </div>
            )}

            {activityTab === 'history' && (
              <div>
                {activity.length === 0 && <Empty text="No history yet." />}
                {activity.slice(0, visibleCount).map((a) => <ActivityRow key={a._id} a={a} nameOf={nameOf} />)}
                {activity.length > visibleCount && (
                  <button style={s.showMore} onClick={() => setVisibleCount((n) => n + 10)}>
                    Show more ({activity.length - visibleCount})
                  </button>
                )}
              </div>
            )}

            {activityTab === 'all' && (
              <div>
                {feed.length === 0 && <Empty text="No activity yet." />}
                {feed.slice(0, visibleCount).map((f) => (
                  f.kind === 'comment'
                    ? <CommentRow key={`c${f.data._id}`} c={f.data} me={me} editingComment={editingComment} setEditingComment={setEditingComment} saveEdit={saveEdit} delComment={delComment} />
                    : <ActivityRow key={`a${f.data._id}`} a={f.data} nameOf={nameOf} />
                ))}
                {feed.length > visibleCount && (
                  <button style={s.showMore} onClick={() => setVisibleCount((n) => n + 10)}>
                    Show more ({feed.length - visibleCount})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* DETAILS */}
        <aside>
          <Select style={{ minWidth: 160 }} value={task.status} onChange={move} disabled={!canEdit}
            options={statusList.map((st) => ({ value: st.key, label: st.name }))} />

          <div className="card" style={{ marginTop: 12 }}>
            <strong>Details</strong>

            <Field label="Assignee">
              <div>
                <Select value={task.assignee_id || ''} onChange={assign} placeholder="Unassigned" disabled={!canAssign}
                  options={[{ value: '', label: 'Unassigned' }, ...members.map((m) => ({ value: m.user_id, label: `${m.full_name}${m.user_id === me ? ' (you)' : ''}` }))]} />
                {!task.assignee_id && meIsMember && canAssign && <button style={s.assignMe} onClick={() => assign(me)}>Assign to me</button>}
              </div>
            </Field>

            <Field label="Priority">
              <Select value={task.priority} onChange={(v) => save({ priority: v })} disabled={!canEdit}
                options={PRIORITIES.map((p) => ({ value: p, label: p }))} />
            </Field>

            <Field label="Start date">
              <input type="date" style={s.fieldSelect} value={task.start_date || ''} disabled={!canEdit}
                max={task.end_date || undefined}
                onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* not supported */ } }}
                onChange={(e) => save({ start_date: e.target.value || null })} />
            </Field>

            <Field label="End date">
              <input type="date" style={s.fieldSelect} value={task.end_date || ''} disabled={!canEdit}
                min={task.start_date || undefined}
                onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* not supported */ } }}
                onChange={(e) => save({ end_date: e.target.value || null, due_date: e.target.value || null })} />
            </Field>

            <Field label="Reporter">
              <span style={s.person}><span style={s.avatarSm}>{initials(nameOf(task.reporter_id))}</span> {nameOf(task.reporter_id) || '—'}</span>
            </Field>

            <Field label="Labels">
              {canEdit ? (
                <LabelPicker value={task.labels || []} onChange={(labels) => save({ labels })} />
              ) : (
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(task.labels || []).length ? (task.labels || []).map((n) => <span key={n} style={s.roLabel}>{n}</span>)
                    : <span style={{ color: 'var(--c-faint)', fontSize: 13 }}>No labels</span>}
                </span>
              )}
            </Field>
          </div>
        </aside>
      </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={s.fieldRow}>
      <span style={s.fieldLabel}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function StatusBadge({ status, statuses }) {
  const st = (statuses || []).find((x) => x.key === status);
  if (st) {
    const name = (st.name || status).toUpperCase();
    return <span style={{ ...s.badge, background: `${st.color}22`, color: st.color }}>{name}</span>;
  }
  return <StatusBadgeLegacy status={status} />;
}

function StatusBadgeLegacy({ status }) {
  const done = DONE.has(status);
  return <span style={{ ...s.badge, background: done ? '#dcfce7' : '#e0e7ff', color: done ? '#166534' : '#3730a3' }}>{(STATUS_LABELS[status] || status).toUpperCase()}</span>;
}

function Empty({ text }) {
  return <p style={{ color: 'var(--c-faint)', fontSize: 14, padding: '14px 0' }}>{text}</p>;
}

const initials2 = initials;

function CommentRow({ c, me, editingComment, setEditingComment, saveEdit, delComment }) {
  return (
    <div style={s.feedRow}>
      <span style={s.avatar}>{initials2(c.author_name)}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: 14 }}>{c.author_name || 'User'} <span style={s.muted}>· {timeAgo(c.created_at)}{c.is_edited ? ' (edited)' : ''}</span></strong>
        </div>
        {editingComment?._id === c._id ? (
          <div>
            <textarea autoFocus style={s.commentEdit} value={editingComment.body}
              onChange={(e) => setEditingComment({ ...editingComment, body: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit(c._id); if (e.key === 'Escape') setEditingComment(null); }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button style={s.btn} onClick={() => saveEdit(c._id)}>Save</button>
              <button style={s.btnGhost} onClick={() => setEditingComment(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ margin: '4px 0', fontSize: 14 }}>{c.body}</div>
            {c.author_id === me && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={s.link} onClick={() => setEditingComment({ _id: c._id, body: c.body })}>Edit</button>
                <button style={s.linkDanger} onClick={() => delComment(c._id)}>Delete</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const FIELD_LABEL = {
  title: 'Title', description: 'Description', priority: 'Priority',
  due_date: 'Due date', labels: 'Labels', type: 'Type', estimate_hours: 'Estimate',
};

// Maps an audit-log entry to a human sentence + optional detail node.
function describeActivity(a, nameOf) {
  const m = a.metadata || {};
  switch (a.action) {
    case 'task.created':
      return { verb: <>created this work item</> };
    case 'task.status_changed':
      return {
        verb: <>changed the <strong>Status</strong></>,
        detail: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <StatusBadge status={m.from} /><span>→</span><StatusBadge status={m.to} />
          </div>
        ),
      };
    case 'task.assigned': {
      const name = m.assignee_id ? (nameOf(m.assignee_id) || 'someone') : null;
      return { verb: name ? <>assigned this to <strong>{name}</strong></> : <>unassigned this</> };
    }
    case 'task.updated': {
      const fields = (m.fields || []).filter((f) => f !== 'updated_at');
      const labels = fields.map((f) => FIELD_LABEL[f] || f);
      return { verb: <>updated {labels.length ? <strong>{labels.join(', ')}</strong> : 'the work item'}</> };
    }
    case 'task.link_added':
      return { verb: <>linked a work item</> };
    case 'task.link_removed':
      return { verb: <>removed a link</> };
    case 'task.archived':
      return { verb: <>archived this work item</> };
    case 'task.deleted':
      return { verb: <>deleted this work item</> };
    default:
      return { verb: <>{(a.action || '').replace('task.', '').replace(/_/g, ' ')}</> };
  }
}

function ActivityRow({ a, nameOf }) {
  const who = a.actor_name || nameOf(a.actor_id) || 'User';
  const { verb, detail } = describeActivity(a, nameOf);
  return (
    <div style={s.feedRow}>
      <span style={s.avatar}>{initials2(who)}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14 }}>
          <strong>{who}</strong> {verb}
          <span style={s.muted}> · {fmtDate(a.created_at)} ({timeAgo(a.created_at)})</span>
        </div>
        {detail}
      </div>
    </div>
  );
}

const s = {
  // Modal layout: fixed header, single scrolling body (so the whole card no longer scrolls in the backdrop).
  rootModal: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  headerModal: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
    padding: '16px 24px', borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface)' },
  scrollBody: { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '20px 24px 28px' },
  readOnlyBar: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '9px 12px', borderRadius: 8,
    background: 'color-mix(in srgb, #f59e0b 12%, var(--c-surface))', border: '1px solid color-mix(in srgb, #f59e0b 35%, var(--c-border))',
    color: 'var(--c-text)', fontSize: 13 },
  readOnlyIcon: { fontSize: 14, lineHeight: 1 },
  readOnlyField: { pointerEvents: 'none', opacity: 0.7 }, // custom-field editors when view-only
  roLabel: { display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999, fontSize: 12.5,
    background: 'var(--c-surface-2)', color: 'var(--c-text)', border: '1px solid var(--c-border)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 10 },
  back: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--c-hover)', border: '1px solid var(--c-border)',
    color: 'var(--c-text)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 8 },
  crumbSep: { color: 'var(--c-faint)' },
  keyCrumb: { display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--c-text)', fontSize: 13 },
  closeBtn: { background: 'none', border: '1px solid var(--c-border)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--c-muted)' },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 24, alignItems: 'start' },
  title: { fontSize: 26, margin: '0 0 16px', cursor: 'text' },
  titleInput: { fontSize: 26, fontWeight: 700, width: '100%', boxSizing: 'border-box', border: '1px solid var(--c-border)', borderRadius: 8, padding: '4px 8px', marginBottom: 16, background: 'var(--c-surface)', color: 'var(--c-text)' },
  section: { marginBottom: 24 },
  sectionHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 13, fontWeight: 700, color: 'var(--c-text)', marginBottom: 8 },
  // Display box and edit textarea share the SAME fixed box model so the size never
  // jumps when you click to edit; long content scrolls instead of growing.
  descBox: { width: '100%', boxSizing: 'border-box', height: 84, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    border: '1px solid var(--c-border)', borderRadius: 8, padding: '10px 12px', cursor: 'text', background: 'var(--c-surface-2)',
    fontSize: 14, lineHeight: 1.5, color: 'var(--c-text)' },
  descArea: { width: '100%', boxSizing: 'border-box', height: 84, resize: 'none', overflowY: 'auto',
    border: '1px solid var(--c-border)', borderRadius: 8, padding: '10px 12px', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5,
    background: 'var(--c-surface)', color: 'var(--c-text)' },
  showMore: { marginTop: 8, padding: '8px 14px', background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
    borderRadius: 8, color: 'var(--c-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  // Compact inline editor for an existing comment (not a big composer-style box).
  commentEdit: { width: '100%', boxSizing: 'border-box', minHeight: 48, resize: 'vertical', margin: '4px 0',
    border: '1px solid var(--c-border)', borderRadius: 8, padding: '8px 10px', fontFamily: 'inherit', fontSize: 14,
    lineHeight: 1.5, background: 'var(--c-surface)', color: 'var(--c-text)' },
  inlineInput: { flex: 1, padding: '8px 10px', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', background: 'var(--c-surface)', color: 'var(--c-text)' },

  // subtasks
  progressWrap: { display: 'flex', alignItems: 'center', gap: 8 },
  progressTrack: { width: 90, height: 6, borderRadius: 4, background: 'var(--c-surface-3)', overflow: 'hidden' },
  progressFill: { height: '100%', background: '#16a34a' },
  progressText: { fontSize: 12, color: 'var(--c-muted)' },
  subRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--c-border)', borderRadius: 8, marginBottom: 6, cursor: 'pointer', fontSize: 14, background: 'var(--c-surface)' },
  subRowInner: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: 'pointer', fontSize: 14 },
  subKey: { color: 'var(--c-text-strong)', fontWeight: 600, fontSize: 12, flexShrink: 0 },
  addLink: { background: 'none', border: 'none', color: 'var(--c-text-strong)', cursor: 'pointer', fontSize: 13, padding: '6px 0', fontWeight: 600 },

  // links
  linkRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  linkType: { fontSize: 11, color: 'var(--c-muted)', width: 92, flexShrink: 0, textTransform: 'capitalize' },
  linkX: { background: 'none', border: 'none', color: 'var(--c-faint)', cursor: 'pointer', fontSize: 12, flexShrink: 0 },
  linkSelect: { padding: '8px 10px', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 14 },
  cfRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--c-border)' },
  cfRelBlock: { padding: '12px 0', borderTop: '1px solid var(--c-border)' },
  cfName: { display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 14, fontWeight: 500, color: 'var(--c-text-strong)' },
  cfIcon: { color: 'var(--c-muted)', display: 'inline-flex' },
  cfLoc: { fontSize: 11, fontWeight: 600, color: 'var(--c-muted)', background: 'var(--c-surface-3)',
    borderRadius: 999, padding: '1px 8px', whiteSpace: 'nowrap' },
  cfInput: { minWidth: 150, maxWidth: 220, padding: '7px 9px', border: '1px solid var(--c-border)', borderRadius: 7, fontSize: 14, background: 'var(--c-surface)', color: 'var(--c-text)' },

  // activity
  tabs: { display: 'flex', gap: 4, border: '1px solid var(--c-border)', borderRadius: 8, padding: 3, width: 'fit-content' },
  tab: { padding: '5px 12px', border: 'none', background: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: 'var(--c-muted)' },
  tabActive: { background: 'var(--c-hover)', color: 'var(--c-text-strong)', fontWeight: 600, border: '1px solid #bfdbfe' },
  feedRow: { display: 'flex', gap: 10, padding: '12px 0', borderTop: '1px solid var(--c-border)' },
  muted: { color: 'var(--c-faint)', fontWeight: 400, fontSize: 12 },
  badge: { fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, letterSpacing: 0.3, flexShrink: 0 },

  avatar: { width: 30, height: 30, borderRadius: '50%', background: '#f59e0b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 },
  avatarSm: { width: 22, height: 22, borderRadius: '50%', background: '#f59e0b', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 },
  statusTop: { width: '100%', padding: '10px 12px', border: '1px solid var(--c-border)', borderRadius: 8, fontWeight: 600, fontSize: 14, background: 'var(--c-hover)' },
  fieldRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--c-border)' },
  fieldLabel: { width: 90, color: 'var(--c-muted)', fontSize: 13, flexShrink: 0 },
  fieldSelect: { padding: '7px 9px', border: '1px solid var(--c-border)', borderRadius: 7, fontSize: 14, width: '100%', boxSizing: 'border-box', background: 'var(--c-surface)', color: 'var(--c-text)' },
  assignMe: { background: 'none', border: 'none', color: 'var(--c-text-strong)', cursor: 'pointer', fontSize: 12, padding: '4px 0 0' },
  person: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 },
  btn: { padding: '7px 14px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, cursor: 'pointer' },
  btnGhost: { padding: '7px 14px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, cursor: 'pointer', color: 'var(--c-text)' },
  link: { background: 'none', border: 'none', color: 'var(--c-text-strong)', cursor: 'pointer', padding: 0, fontSize: 13 },
  linkDanger: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontSize: 13 },
};
