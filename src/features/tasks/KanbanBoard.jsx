import { useState } from 'react';
import { tasksApi, PRIORITY_COLOR } from './tasksApi';
import { useAuth } from '../auth/useAuth';
import { useConfirm } from '../../components/ConfirmDialog';
import { IconChevronDown, IconCalendar, IconUser, IconEnter } from '../../components/icons';
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

const shortDate = (d) => (d ? new Date(`${d}T00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');
const initials = (n) => (n || '?').split(/[\s@.]+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function KanbanBoard({ tasks, onChanged, projectId, listId = null, members = [], statuses = [], onOpenTask }) {
  const open = onOpenTask || (() => {});
  // Columns come from the space's own workflow. Include any orphan statuses found
  // on tasks (e.g. legacy) so nothing is hidden.
  const columns = [...statuses];
  tasks.forEach((t) => {
    if (!columns.some((c) => c.key === t.status)) columns.push({ key: t.status, name: t.status, color: '#6b7280' });
  });
  const { can, user } = useAuth();
  const confirm = useConfirm();
  const me = user?._id || user?.id;
  const [dragId, setDragId] = useState(null);
  const [error, setError] = useState(null);

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

  const typeIcon = (t) => (TYPE_ICON[t] || '☑️');
  const assigneeName = (uid) => members.find((m) => m.user_id === uid)?.full_name;

  const openCardMenu = (task, e) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setCardMenu(cardMenu?.id === task._id ? null : { id: task._id, x: r.right, y: r.bottom + 4 });
  };
  const deleteCard = async (id) => {
    setCardMenu(null);
    const task = tasks.find((t) => t._id === id);
    const ok = await confirm({
      title: `Delete: ${task?.title || 'task'}`,
      message: 'This task will be permanently deleted. This cannot be undone.',
    });
    if (!ok) return;
    try { await tasksApi.remove(id); onChanged(); }
    catch (err) { setError(err.response?.data?.error?.message || 'Could not delete task'); }
  };

  const canCreate = can('task.create') && !!projectId;
  const byStatus = (st) => tasks.filter((t) => t.status === st);
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
    setError(null);
    const task = tasks.find((t) => t._id === dragId);
    setDragId(null);
    if (!task || task.status === status) return;
    // ClickUp-style: tasks move freely between any of the space's statuses.
    try { await tasksApi.changeStatus(task._id, { to_status: status }); onChanged(); }
    catch (err) { setError(err.response?.data?.error?.message || 'Could not move task'); }
  };

  const submitCreate = async (st) => {
    const value = title.trim();
    if (!value) return;
    setSaving(true); setPicker(null);
    try {
      await tasksApi.create({
        project_id: projectId, list_id: listId, title: value, status: st, type,
        due_date: dueDate || null, assignee_id: assigneeId || null,
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
    <div>
      {error && <p style={{ color: '#991b1b' }}>{error}</p>}
      <div style={s.board}>
        {columns.map((col) => {
          const st = col.key;
          const bg = `${col.color}14`; // soft tint of the status color (over white)
          return (
          <div key={st} className="wg-col" style={{ background: bg }}
            onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(st)}>
            <div className="wg-col-head" style={{ background: bg }}>
              <span style={{ ...s.statusDot, background: col.color }} />
              <span style={{ flex: 1, color: col.color }}>{col.name}</span>
              <span style={s.count}>{byStatus(st).length}</span>
            </div>
            <div className="wg-col-body">
              {byStatus(st).map((t) => {
                const subCount = tasks.filter((x) => x.parent_id === t._id).length;
                return (
                <div key={t._id} className="wg-card"
                  draggable onDragStart={() => setDragId(t._id)}
                  onClick={() => open(t._id)}>
                  <div style={s.cardTop}>
                    <span style={s.cardTitle}>{t.title}</span>
                    <button className="icon-btn wg-quick" title="Actions" onClick={(e) => openCardMenu(t, e)}>⋯</button>
                  </div>

                  <div style={s.chipsRow}>
                    <span style={{ ...s.priChip, color: PRIORITY_COLOR[t.priority], background: `${PRIORITY_COLOR[t.priority]}1a` }}>
                      <span style={{ ...s.priDot, background: PRIORITY_COLOR[t.priority] }} />{t.priority}
                    </span>
                    {t.due_date && <span style={s.metaChip}>📅 {shortDate(t.due_date)}</span>}
                    {subCount > 0 && <span style={s.metaChip} title={`${subCount} subtasks`}>☑ {subCount}</span>}
                    {(t.labels || []).slice(0, 2).map((l) => <span key={l} style={s.labelChip}>{l}</span>)}
                  </div>

                  <div style={s.cardBottom}>
                    <span style={s.idRow}>
                      <span title={t.type} style={{ display: 'inline-flex', color: '#6b7280' }}><TaskTypeIcon type={t.type} size={14} /></span>
                      <span style={s.key}>{t.key}</span>
                    </span>
                    {t.assignee_id
                      ? <span style={s.cardAvatar} title={assigneeName(t.assignee_id) || 'Assignee'}>{initials(assigneeName(t.assignee_id) || '?')}</span>
                      : <span style={s.cardAvatarEmpty} title="Unassigned">+</span>}
                  </div>
                </div>
                );
              })}

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
                        {assigneeLabel ? <span style={s.miniAvatar}>{initials(assigneeLabel)}</span> : <IconUser size={15} />}
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
          <div style={{ ...s.popFixed, top: cardMenu.y, left: cardMenu.x - 150, minWidth: 150 }}>
            <button style={s.popItem} onClick={() => { const id = cardMenu.id; setCardMenu(null); open(id); }}>Open</button>
            <button style={{ ...s.popItem, color: '#b91c1c' }} onClick={() => deleteCard(cardMenu.id)}>Delete</button>
          </div>
        </>
      )}

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
                      <span style={s.miniAvatar}>{initials(m.full_name)}</span>
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
  board: { display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start', height: '100%' },
  statusDot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  count: { background: '#e6e9ee', color: '#64748b', borderRadius: 999, padding: '1px 9px', fontWeight: 700, fontSize: 12 },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: '#1f2430', display: '-webkit-box',
    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  chipsRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 10 },
  priChip: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
    textTransform: 'capitalize', borderRadius: 999, padding: '2px 9px' },
  priDot: { width: 7, height: 7, borderRadius: 999 },
  metaChip: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
    color: '#64748b', background: '#f1f5f9', borderRadius: 999, padding: '2px 8px' },
  labelChip: { fontSize: 11, fontWeight: 600, background: '#f1f2f4', color: '#000000', borderRadius: 999, padding: '2px 8px' },
  cardBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  idRow: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  cardAvatar: { width: 26, height: 26, borderRadius: '50%', background: '#111827', color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 },
  cardAvatarEmpty: { width: 26, height: 26, borderRadius: '50%', background: '#fff', border: '1.5px dashed #cbd5e1',
    color: '#94a3b8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 },
  key: { fontWeight: 700, color: '#111827', fontSize: 12, letterSpacing: '.02em' },
  createBtn: { display: 'flex', alignItems: 'center', gap: 6, width: '100%', boxSizing: 'border-box',
    padding: '9px 12px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
    borderRadius: 8, fontSize: 13, fontWeight: 600, textAlign: 'left', marginTop: 2 },
  composer: { background: '#fff', border: '2px solid #111827', borderRadius: 10, padding: 10 },
  composerTop: { display: 'flex', justifyContent: 'flex-end', marginBottom: 2 },
  composerClose: { background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 13, padding: 2 },
  composerInput: { width: '100%', boxSizing: 'border-box', border: 'none', outline: 'none',
    resize: 'none', fontSize: 14, fontFamily: 'inherit' },
  composerBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, flexWrap: 'wrap', gap: 6 },
  tbtn: { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: 7, padding: '5px 8px', cursor: 'pointer', fontSize: 13, color: '#475569' },
  tbtnIcon: { display: 'inline-flex', fontSize: 14, lineHeight: 1 },
  dateBtn: { display: 'inline-flex', alignItems: 'center', background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: 7, padding: '5px 8px', cursor: 'pointer', fontSize: 13, color: '#475569', position: 'relative', overflow: 'hidden' },
  dateInput: { position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' },
  miniAvatar: { width: 18, height: 18, borderRadius: '50%', background: '#f59e0b', color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 },
  cancelBtn: { background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '2px 10px',
    cursor: 'pointer', color: '#6b7280', fontSize: 13 },
  enterBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, background: '#111827', border: 'none',
    borderRadius: 7, padding: '6px 12px', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600 },
  enterBtnOff: { background: '#e5e7eb', color: '#9ca3af', cursor: 'not-allowed' },
  // Fixed pickers
  pickBackdrop: { position: 'fixed', inset: 0, zIndex: 400 },
  popFixed: { position: 'fixed', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
    boxShadow: '0 12px 32px rgba(0,0,0,.2)', zIndex: 401, minWidth: 200, padding: 4 },
  popSearch: { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #d1d5db',
    borderRadius: 6, fontSize: 14, marginBottom: 4 },
  popItem: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
    background: 'none', border: 'none', padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 14 },
  popEmpty: { padding: '8px 10px', color: '#6b7280', fontSize: 13 },
};
