import { useEffect, useRef, useState } from 'react';
import { tasksApi, resolveStatuses } from './tasksApi';
import { projectsApi } from '../projects/projectsApi';
import { customFieldsApi, FIELD_TYPE_LABEL } from '../customfields/customFieldsApi';
import CustomFieldManager from '../customfields/CustomFieldManager';
import CustomFieldValue from '../customfields/CustomFieldValue';
import {
  IconUser, IconCalendar, IconFlag, IconChevronDown, IconPlus, IconClose,
  IconList, IconBoard, IconFieldDropdown, IconFieldText, IconFieldRelationship,
} from '../../components/icons';
import TaskTypeIcon from '../../components/TaskTypeIcon';

const initials = (n) => (n || '?').split(/[\s@.]+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const shortDate = (d) => (d ? new Date(`${d}T00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

// ClickUp priorities → our values.
const PRIORITY_OPTS = [
  { value: 'critical', label: 'Urgent', color: '#ef4444' },
  { value: 'high', label: 'High', color: '#eab308' },
  { value: 'medium', label: 'Normal', color: '#3b82f6' },
  { value: 'low', label: 'Low', color: '#9ca3af' },
];
const priLabel = (v) => PRIORITY_OPTS.find((p) => p.value === v)?.label || 'Priority';
const priColor = (v) => PRIORITY_OPTS.find((p) => p.value === v)?.color || '#9ca3af';
const FIELD_CMP = { dropdown: IconFieldDropdown, relationship: IconFieldRelationship, text: IconFieldText };

/**
 * ClickUp-style task creation card: name + description, inline property pills
 * (status / assignee / due date / priority / tags) and a custom-fields section.
 */
export default function TaskModal({ open, mode, task, projects, defaultProjectId, listId = null, listName, statuses, onClose, onSaved }) {
  const spaceId = (mode === 'edit' && task) ? task.project_id : (defaultProjectId || projects?.[0]?._id);
  const spaceName = projects?.[0]?.name || 'Space';
  const sts = (statuses && statuses.length) ? statuses : resolveStatuses(projects?.[0]);
  const defStatus = sts.find((s) => s.group === 'not_started')?.key || sts[0]?.key;

  const [form, setForm] = useState({ title: '', description: '', type: 'task', priority: null, assignee_id: '', start_date: '', end_date: '', labels: [], status: defStatus });
  const [subtasks, setSubtasks] = useState([]); // titles to create as children (create mode)
  const [members, setMembers] = useState([]);
  const [fields, setFields] = useState([]);
  const [values, setValues] = useState({});
  const [showFields, setShowFields] = useState(true);
  const [pop, setPop] = useState(null);   // open popover key
  const [cfOpen, setCfOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const rootRef = useRef(null);
  const startRef = useRef(null);
  const endRef = useRef(null);

  // Open the native date picker on a click anywhere in the pill (not just the icon).
  const openPicker = (ref) => { try { ref.current?.showPicker?.(); } catch { /* not supported */ } };

  const loadFields = () => customFieldsApi.list(spaceId, listId, undefined, { _silent: true }).then((all) => {
    // Hide inherited Space fields that were disabled for this List.
    const fs = all.filter((f) => f.enabled !== false);
    setFields(fs);
    // Seed ClickUp-style default values for dropdown options marked default (create only).
    if (mode !== 'edit') {
      setValues((cur) => {
        const next = { ...cur };
        for (const f of fs) {
          if (f.type === 'dropdown' && next[f._id] == null) {
            const defs = (f.config?.options || []).filter((o) => o.default).map((o) => o.label);
            if (defs.length) next[f._id] = f.config?.multiple ? defs : defs[0];
          }
        }
        return next;
      });
    }
  }).catch(() => setFields([]));

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && task) {
      setForm({ title: task.title, description: task.description || '', type: task.type, priority: task.priority,
        assignee_id: task.assignee_id || '', start_date: task.start_date || '', end_date: task.end_date || task.due_date || '',
        labels: task.labels || [], status: task.status });
      setValues(task.custom_fields || {});
    } else {
      setForm({ title: '', description: '', type: 'task', priority: null, assignee_id: '', start_date: '', end_date: '', labels: [], status: defStatus });
      setValues({});
    }
    setSubtasks([]);
    setPop(null); setError(null); setShowFields(true);
    if (spaceId) projectsApi.members(spaceId, { _silent: true }).then(setMembers).catch(() => setMembers([]));
    if (spaceId) loadFields();
  }, [open, mode, task, spaceId, listId]); // eslint-disable-line

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!e.target.closest?.('[data-pop]') && !e.target.closest?.('[data-pill]')) setPop(null); };
    const onEsc = (e) => { if (e.key === 'Escape') (pop ? setPop(null) : onClose()); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open, pop, onClose]);

  if (!open) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setVal = (id, v) => setValues((m) => ({ ...m, [id]: v }));
  const statusOf = (key) => sts.find((s) => s.key === key) || { key, name: key, color: '#94a3b8' };
  const assigneeName = members.find((m) => m.user_id === form.assignee_id)?.full_name;

  const submit = async () => {
    if (!form.title.trim()) { setError('Task name is required'); return; }
    setSaving(true); setError(null);
    const cf = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '' && v != null && !(Array.isArray(v) && v.length === 0)));
    try {
      let created = task;
      if (mode === 'edit') {
        await tasksApi.update(task._id, { title: form.title, description: form.description, type: form.type,
          priority: form.priority || 'medium', start_date: form.start_date || null, end_date: form.end_date || null,
          due_date: form.end_date || null, labels: form.labels, custom_fields: cf });
        if (form.status !== task.status) await tasksApi.changeStatus(task._id, { to_status: form.status });
      } else {
        created = await tasksApi.create({ project_id: spaceId, list_id: listId, title: form.title.trim(),
          description: form.description || null, type: form.type, priority: form.priority || 'medium',
          assignee_id: form.assignee_id || null, start_date: form.start_date || null, end_date: form.end_date || null,
          due_date: form.end_date || null, labels: form.labels, status: form.status, custom_fields: cf });
        // Create any subtasks as children of the new task.
        for (const title of subtasks.map((t) => t.trim()).filter(Boolean)) {
          await tasksApi.create({ project_id: spaceId, list_id: listId, title, type: 'subtask', parent_id: created._id }).catch(() => {});
        }
      }
      onSaved(created);
    } catch (err) { setError(err.response?.data?.error?.message || 'Could not save task'); }
    finally { setSaving(false); }
  };

  const cur = statusOf(form.status);

  return (
    <div style={s.backdrop} onMouseDown={onClose}>
      <div style={s.modal} ref={rootRef}
        onMouseDown={(e) => {
          e.stopPropagation();
          // Click anywhere inside the modal that isn't a pill or an open popover closes the popover.
          if (!e.target.closest?.('[data-pop]') && !e.target.closest?.('[data-pill]')) setPop(null);
        }}>
        {/* Tabs */}
        <div style={s.tabs}>
          <span style={{ ...s.tab, ...s.tabActive }}>Task</span>
          <div style={{ flex: 1 }} />
          <button className="icon-btn" onClick={onClose} title="Close"><IconClose size={16} /></button>
        </div>

        <div style={s.body}>
          {/* List + Type */}
          <div style={s.topRow}>
            <span style={{ ...s.selPill, cursor: 'default' }}><IconList size={14} /> {listName || 'List'}</span>
            <span data-pill style={s.selPill} onClick={() => setPop(pop === 'type' ? null : 'type')}>
              <IconBoard size={14} /> {form.type === 'bug' ? 'Bug' : 'Task'} <IconChevronDown size={14} />
              {pop === 'type' && (
                <div data-pop style={{ ...s.popover, left: 0 }}>
                  {['task', 'bug'].map((t) => (
                    <button key={t} style={s.popItem} onClick={() => { set('type', t); setPop(null); }}>{t === 'bug' ? 'Bug' : 'Task'}</button>
                  ))}
                </div>
              )}
            </span>
          </div>

          <input autoFocus style={s.nameInput} placeholder="Task Name" value={form.title} onChange={(e) => set('title', e.target.value)} />
          <textarea style={s.descInput} placeholder="Add description…" value={form.description} onChange={(e) => set('description', e.target.value)} />

          {/* Property pills */}
          <div style={s.pills}>
            {/* Status */}
            <div style={{ position: 'relative' }}>
              <button data-pill style={{ ...s.pill, ...s.statusPill }} onClick={() => setPop(pop === 'status' ? null : 'status')}>
                <span style={{ ...s.dot, background: cur.color }} />{(cur.name || '').toUpperCase()}
              </button>
              {pop === 'status' && (
                <div data-pop style={s.popover}>
                  {sts.map((st) => (
                    <button key={st.key} style={s.popItem} onClick={() => { set('status', st.key); setPop(null); }}>
                      <span style={{ ...s.dot, background: st.color }} /> {st.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Assignee */}
            <div style={{ position: 'relative' }}>
              <button data-pill style={s.pill} onClick={() => setPop(pop === 'assignee' ? null : 'assignee')}>
                {form.assignee_id ? <span style={s.avatar}>{initials(assigneeName)}</span> : <IconUser size={15} />}
                {assigneeName || 'Assignee'}
              </button>
              {pop === 'assignee' && (
                <div data-pop style={s.popover}>
                  <button style={s.popItem} onClick={() => { set('assignee_id', ''); setPop(null); }}><IconUser size={15} /> Unassigned</button>
                  {members.map((m) => (
                    <button key={m.user_id} style={s.popItem} onClick={() => { set('assignee_id', m.user_id); setPop(null); }}>
                      <span style={s.avatar}>{initials(m.full_name)}</span> {m.full_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Start date */}
            <button type="button" data-pill style={s.pill} onClick={() => openPicker(startRef)}>
              <IconCalendar size={15} />{form.start_date ? `Start: ${shortDate(form.start_date)}` : 'Start date'}
              <input ref={startRef} type="date" value={form.start_date} max={form.end_date || undefined}
                onChange={(e) => set('start_date', e.target.value)} style={s.hiddenInput} tabIndex={-1} />
            </button>

            {/* End date */}
            <button type="button" data-pill style={s.pill} onClick={() => openPicker(endRef)}>
              <IconCalendar size={15} />{form.end_date ? `End: ${shortDate(form.end_date)}` : 'End date'}
              <input ref={endRef} type="date" value={form.end_date} min={form.start_date || undefined}
                onChange={(e) => set('end_date', e.target.value)} style={s.hiddenInput} tabIndex={-1} />
            </button>

            {/* Priority */}
            <div style={{ position: 'relative' }}>
              <button data-pill style={s.pill} onClick={() => setPop(pop === 'priority' ? null : 'priority')}>
                <span style={{ color: priColor(form.priority) }}><IconFlag size={15} /></span>{form.priority ? priLabel(form.priority) : 'Priority'}
              </button>
              {pop === 'priority' && (
                <div data-pop style={s.popover}>
                  <div style={s.popHead}>Priority</div>
                  {PRIORITY_OPTS.map((p) => (
                    <button key={p.value} style={s.popItem} onClick={() => { set('priority', p.value); setPop(null); }}>
                      <span style={{ color: p.color }}><IconFlag size={15} /></span> {p.label}
                    </button>
                  ))}
                  <div style={s.popDivider} />
                  <button style={s.popItem} onClick={() => { set('priority', null); setPop(null); }}>⊘ Clear</button>
                </div>
              )}
            </div>

          </div>

          {/* Fields */}
          <div style={s.fieldsLabel}>Fields</div>
          {!showFields ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={s.softBtn} onClick={() => setShowFields(true)}>Show custom fields</button>
              <button style={s.softBtn} onClick={() => setCfOpen(true)}><IconPlus size={14} /> Create new field</button>
            </div>
          ) : (
            <div>
              {fields.length === 0 && <div style={{ color: 'var(--c-faint)', fontSize: 14, padding: '6px 0' }}>No custom fields yet.</div>}
              {fields.map((f) => {
                const Cmp = FIELD_CMP[f.type] || IconFieldText;
                // Relationship fields render full-width (name on top, related-task table below);
                // dropdown/text stay on a compact inline row.
                if (f.type === 'relationship') {
                  return (
                    <div key={f._id} style={s.fieldRelBlock}>
                      <span style={s.fieldName}><span style={s.fieldIcon}><Cmp size={14} /></span>{f.name}</span>
                      <div style={{ marginTop: 8 }}>
                        <CustomFieldValue field={f} value={values[f._id]} onChange={(v) => setVal(f._id, v)} spaceId={spaceId} currentListId={listId} />
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={f._id} style={s.fieldRow}>
                    <span style={s.fieldName}><span style={s.fieldIcon}><Cmp size={14} /></span>{f.name}</span>
                    <div style={{ flex: 1 }} />
                    <CustomFieldValue field={f} value={values[f._id]} onChange={(v) => setVal(f._id, v)} spaceId={spaceId} currentListId={listId} />
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button style={s.softBtn} onClick={() => setShowFields(false)}>Hide empty fields</button>
                <button style={s.softBtn} onClick={() => setCfOpen(true)}><IconPlus size={14} /> Create new field</button>
              </div>
            </div>
          )}

          {/* Subtasks (create mode) */}
          {mode !== 'edit' && (
            <div style={{ marginTop: 18 }}>
              <div style={s.fieldsLabel}>Subtasks</div>
              {subtasks.map((st, i) => (
                <div key={i} style={s.subRow}>
                  <span style={s.fieldIcon}><TaskTypeIcon type="subtask" size={14} /></span>
                  <input style={s.subInput} placeholder="Subtask name" value={st} autoFocus
                    onChange={(e) => setSubtasks((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setSubtasks((arr) => [...arr, '']); } }} />
                  <button style={s.subDel} title="Remove" onClick={() => setSubtasks((arr) => arr.filter((_, j) => j !== i))}><IconClose size={14} /></button>
                </div>
              ))}
              <button style={s.softBtn} onClick={() => setSubtasks((arr) => [...arr, ''])}><IconPlus size={14} /> Add subtask</button>
            </div>
          )}

          {error && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 10 }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <div style={{ flex: 1 }} />
          <button style={s.createBtn} onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : (mode === 'edit' ? 'Save' : 'Create Task')}
          </button>
        </div>
      </div>

      <CustomFieldManager open={cfOpen} scope={listId ? 'list' : 'space'} spaceId={spaceId} listId={listId}
        spaceName={spaceName} listName={listName}
        onClose={() => { setCfOpen(false); loadFields(); }} />
    </div>
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 75, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', overflowY: 'auto' },
  modal: { background: 'var(--c-surface)', borderRadius: 14, width: 760, maxWidth: '96vw', boxShadow: '0 24px 64px rgba(16,24,40,.3)', display: 'flex', flexDirection: 'column' },
  tabs: { display: 'flex', alignItems: 'center', gap: 22, padding: '14px 20px', borderBottom: '1px solid var(--c-border)' },
  tab: { fontSize: 15, cursor: 'default' },
  tabActive: { color: 'var(--c-text-strong)', fontWeight: 700, borderBottom: '2px solid var(--c-text-strong)', paddingBottom: 12, marginBottom: -14 },
  tabMuted: { color: 'var(--c-faint)' },
  body: { padding: '18px 20px', display: 'flex', flexDirection: 'column' },
  topRow: { display: 'flex', gap: 10, marginBottom: 14 },
  selPill: { position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--c-text)', cursor: 'pointer' },
  nameInput: { border: 'none', outline: 'none', fontSize: 24, fontWeight: 600, color: 'var(--c-text-strong)', background: 'var(--c-surface)', padding: '4px 0', marginBottom: 4 },
  descInput: { border: 'none', outline: 'none', fontSize: 15, color: 'var(--c-text)', background: 'var(--c-surface)', minHeight: 70, resize: 'vertical', fontFamily: 'inherit', marginBottom: 12 },
  pills: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  pill: { position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)', cursor: 'pointer', fontSize: 13, color: 'var(--c-muted)', fontWeight: 500 },
  statusPill: { background: 'var(--c-hover)', fontWeight: 700, color: 'var(--c-text)' },
  dot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  avatar: { width: 18, height: 18, borderRadius: '50%', background: '#f59e0b', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 },
  hiddenInput: { position: 'absolute', inset: 0, opacity: 0, width: '100%', pointerEvents: 'none' },
  popover: { position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 200, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, boxShadow: '0 14px 34px rgba(16,24,40,.18)', zIndex: 5, padding: 5 },
  popHead: { fontSize: 11, color: 'var(--c-faint)', textTransform: 'uppercase', padding: '4px 10px' },
  popItem: { display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 7, fontSize: 14, color: 'var(--c-text)' },
  popDivider: { height: 1, background: 'var(--c-border)', margin: '4px 0' },
  tagInput: { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 14, background: 'var(--c-surface)', color: 'var(--c-text)' },
  fieldsLabel: { fontSize: 13, color: 'var(--c-faint)', marginBottom: 10 },
  fieldRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderTop: '1px solid var(--c-border)' },
  fieldRelBlock: { padding: '12px 0', borderTop: '1px solid var(--c-border)' },
  fieldName: { display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 14, fontWeight: 500, color: 'var(--c-text-strong)' },
  fieldIcon: { color: 'var(--c-muted)', display: 'inline-flex' },
  fieldInput: { minWidth: 160, maxWidth: 240, padding: '7px 9px', border: '1px solid var(--c-border)', borderRadius: 7, fontSize: 14, background: 'var(--c-surface)', color: 'var(--c-text)' },
  addTaskBtn: { border: '1px solid var(--c-border)', borderRadius: 7, padding: '6px 12px', fontSize: 13, color: 'var(--c-muted)', cursor: 'pointer' },
  softBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--c-hover)', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: 'var(--c-text)', cursor: 'pointer' },
  subRow: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 },
  subInput: { flex: 1, padding: '8px 10px', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 14, background: 'var(--c-surface)', color: 'var(--c-text)' },
  subDel: { background: 'none', border: 'none', color: 'var(--c-faint)', cursor: 'pointer', display: 'inline-flex', flexShrink: 0 },
  footer: { display: 'flex', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid var(--c-border)' },
  createBtn: { background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
};
