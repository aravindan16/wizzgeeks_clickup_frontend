import { useEffect, useState } from 'react';
import { dailyApi, ENTRY_STATUS, todayStr } from './dailyApi';
import { projectsApi } from '../projects/projectsApi';
import { tasksApi } from '../tasks/tasksApi';
import Select from '../../components/Select';

const emptyEntry = () => ({ project_id: '', task_id: '', work_done: '', hours_spent: '', blockers: '', status: 'in_progress' });

/**
 * Today's daily update form. Loads today's existing update (if any) to edit it,
 * otherwise creates a new one. Supports multiple task-linked entries.
 */
export default function DailyActivityForm({ onSaved }) {
  const [existing, setExisting] = useState(null);
  const [entries, setEntries] = useState([emptyEntry()]);
  const [tomorrow, setTomorrow] = useState('');
  const [projects, setProjects] = useState([]);
  const [tasksByProject, setTasksByProject] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    projectsApi.list({ limit: 200 }).then((d) => setProjects(d.items)).catch(() => {});
    dailyApi.mine({ date_from: todayStr(), date_to: todayStr() }).then((d) => {
      if (d.items.length > 0) {
        const u = d.items[0];
        setExisting(u);
        setEntries(u.entries.map((e) => ({
          project_id: e.project_id || '', task_id: e.task_id || '',
          work_done: e.work_done, hours_spent: e.hours_spent ?? '',
          blockers: e.blockers || '', status: e.status,
        })));
        setTomorrow(u.tomorrow_plan || '');
      }
    }).catch(() => {});
  }, []);

  const loadTasks = (pid) => {
    if (!pid || tasksByProject[pid]) return;
    tasksApi.list({ project_id: pid, limit: 200 }).then((d) =>
      setTasksByProject((m) => ({ ...m, [pid]: d.items }))).catch(() => {});
  };

  const setEntry = (i, k, v) => {
    setEntries((es) => es.map((e, idx) => (idx === i ? { ...e, [k]: v } : e)));
    if (k === 'project_id') loadTasks(v);
  };
  const addEntry = () => setEntries((es) => [...es, emptyEntry()]);
  const removeEntry = (i) => setEntries((es) => es.filter((_, idx) => idx !== i));

  const totalHours = entries.reduce((sum, e) => sum + (Number(e.hours_spent) || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setMsg(null); setSaving(true);
    const payloadEntries = entries.map((en) => ({
      project_id: en.project_id || null, task_id: en.task_id || null,
      work_done: en.work_done, hours_spent: Number(en.hours_spent) || 0,
      blockers: en.blockers || null, status: en.status,
    }));
    try {
      if (existing) {
        await dailyApi.update(existing._id, { entries: payloadEntries, tomorrow_plan: tomorrow });
        setMsg('Update saved.');
      } else {
        const created = await dailyApi.create({ entries: payloadEntries, tomorrow_plan: tomorrow });
        setExisting(created);
        setMsg('Daily update submitted.');
      }
      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card" style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>{existing ? "Edit Today's Update" : "Today's Daily Update"}</h3>
        <span style={{ color: '#6b7280' }}>{todayStr()} · {totalHours}h</span>
      </div>

      {entries.map((en, i) => (
        <div key={i} style={s.entry}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Select style={{ flex: 1, minWidth: 130 }} value={en.project_id} onChange={(v) => setEntry(i, 'project_id', v)}
              placeholder="Project…"
              options={[{ value: '', label: 'Project…' }, ...projects.map((p) => ({ value: p._id, label: p.key }))]} />
            <Select style={{ flex: 1, minWidth: 130 }} value={en.task_id} onChange={(v) => setEntry(i, 'task_id', v)}
              placeholder="Task…"
              options={[{ value: '', label: 'Task…' }, ...(tasksByProject[en.project_id] || []).map((t) => ({ value: t._id, label: `${t.key} ${t.title}` }))]} />
            <input style={{ ...s.input, width: 90 }} type="number" min="0" step="0.5" placeholder="hrs"
              value={en.hours_spent} onChange={(ev) => setEntry(i, 'hours_spent', ev.target.value)} />
            <Select style={{ width: 130 }} value={en.status} onChange={(v) => setEntry(i, 'status', v)}
              options={ENTRY_STATUS.map((st) => ({ value: st, label: st }))} />
          </div>
          <textarea style={s.input} placeholder="Work done…" value={en.work_done}
            onChange={(ev) => setEntry(i, 'work_done', ev.target.value)} required />
          <input style={s.input} placeholder="Blockers (optional)" value={en.blockers}
            onChange={(ev) => setEntry(i, 'blockers', ev.target.value)} />
          {entries.length > 1 && (
            <button type="button" style={s.removeBtn} onClick={() => removeEntry(i)}>Remove entry</button>
          )}
        </div>
      ))}

      <button type="button" style={s.addBtn} onClick={addEntry}>+ Add entry</button>

      <label style={{ display: 'block', marginTop: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Tomorrow's plan</span>
        <textarea style={s.input} value={tomorrow} onChange={(e) => setTomorrow(e.target.value)} />
      </label>

      {error && <p style={{ color: '#991b1b' }}>{error}</p>}
      {msg && <p style={{ color: '#166534' }}>{msg}</p>}
      <button type="submit" disabled={saving} style={s.submit}>
        {saving ? 'Saving…' : existing ? 'Save changes' : 'Submit update'}
      </button>
    </form>
  );
}

const s = {
  entry: { border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, marginTop: 12,
    display: 'flex', flexDirection: 'column', gap: 8 },
  input: { padding: '8px 11px', border: '1px solid #d1d5db', borderRadius: 8, width: '100%' },
  addBtn: { marginTop: 12, padding: '8px 14px', background: '#fff', border: '1px dashed #9ca3af',
    borderRadius: 8, cursor: 'pointer' },
  removeBtn: { alignSelf: 'flex-start', background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', padding: 0 },
  submit: { marginTop: 14, padding: '10px 20px', background: '#111827', color: '#fff', border: 'none',
    borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
};
