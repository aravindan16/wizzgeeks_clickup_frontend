import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useHeaderSlot } from '../../layouts/headerSlot';
import { tasksApi } from '../tasks/tasksApi';
import { dashboardsApi } from '../dashboard/dashboardsApi';
import { useToast } from '../../components/Toast';
import Select from '../../components/Select';
import LabelPicker from '../labels/LabelPicker';

const STEPS = ['Choose Work items', 'Choose Operation', 'Operation Details', 'Confirmation'];
const PRIORITIES = ['urgent', 'high', 'medium', 'low'];
const cap = (x) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x);

/**
 * Jira-style multi-step "Bulk Operation" page. Receives the selected tasks via
 * router state (from the Filters results table) and walks the user through:
 *   1) Choose work items → 2) Choose operation → 3) Operation details → 4) Confirm.
 */
export default function FilterBulkPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const slotEl = useHeaderSlot();
  const toast = useToast();

  const initial = location.state?.tasks || [];
  const [items, setItems] = useState(() => initial.map((t) => ({ ...t, _sel: true })));
  const [step, setStep] = useState(0);
  const [operation, setOperation] = useState('edit'); // edit | delete
  const [users, setUsers] = useState([]);
  const [edit, setEdit] = useState({ priorityOn: false, priority: 'medium', assigneeOn: false, assignee: '',
    reporterOn: false, reporter: '', dueOn: false, due: '', labelsOn: false, labels: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { dashboardsApi.searchUsers('').then((u) => setUsers(Array.isArray(u) ? u : (u?.items || []))).catch(() => setUsers([])); }, []);

  // No tasks (e.g. opened directly) → back to Filters.
  useEffect(() => { if (!initial.length) navigate('/filters', { replace: true }); }, []); // eslint-disable-line

  const chosen = useMemo(() => items.filter((t) => t._sel), [items]);
  const userName = (id) => users.find((u) => String(u.user_id) === String(id))?.full_name
    || users.find((u) => String(u.user_id) === String(id))?.email || (id ? '—' : 'Unassigned');

  const toggle = (id) => setItems((arr) => arr.map((t) => (t._id === id ? { ...t, _sel: !t._sel } : t)));

  const next = () => {
    setError('');
    if (step === 0 && chosen.length === 0) { setError('You must select at least one work item to bulk edit.'); return; }
    setStep((n) => Math.min(n + 1, STEPS.length - 1));
  };
  const back = () => { setError(''); setStep((n) => Math.max(n - 1, 0)); };

  const changes = useMemo(() => {
    if (operation === 'delete') return [{ name: 'Delete', action: 'Permanently delete', value: `${chosen.length} work item${chosen.length === 1 ? '' : 's'}` }];
    const out = [];
    if (edit.priorityOn) out.push({ name: 'Priority', action: 'Change to', value: cap(edit.priority) });
    if (edit.assigneeOn) out.push({ name: 'Assignee', action: 'Change to', value: edit.assignee ? userName(edit.assignee) : 'Unassigned' });
    if (edit.reporterOn) out.push({ name: 'Reporter', action: 'Change to', value: edit.reporter ? userName(edit.reporter) : 'None' });
    if (edit.dueOn) out.push({ name: 'Due date', action: 'Change to', value: edit.due || 'None' });
    if (edit.labelsOn) out.push({ name: 'Labels', action: 'Add to existing', value: edit.labels.length ? edit.labels.join(', ') : 'None' });
    return out;
  }, [operation, edit, chosen.length, users]);

  const confirm = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (operation === 'delete') {
        for (const t of chosen) await tasksApi.remove(t._id);
        toast.success(`Deleted ${chosen.length} work item${chosen.length === 1 ? '' : 's'}`);
      } else {
        for (const t of chosen) {
          const patch = {};
          if (edit.priorityOn) patch.priority = edit.priority;
          if (edit.dueOn) { patch.end_date = edit.due || null; patch.due_date = edit.due || null; }
          if (edit.reporterOn) patch.reporter_id = edit.reporter || null;
          // Labels: add the chosen labels to each task's existing labels (dedup).
          if (edit.labelsOn) patch.labels = Array.from(new Set([...(t.labels || []), ...edit.labels]));
          if (Object.keys(patch).length) await tasksApi.update(t._id, patch);
          if (edit.assigneeOn) await tasksApi.assign(t._id, edit.assignee || null);
        }
        toast.success(`Updated ${chosen.length} work item${chosen.length === 1 ? '' : 's'}`);
      }
      navigate(-1);
    } catch { setError('The bulk operation could not be completed.'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      {slotEl && createPortal(
        <span style={s.crumbs}>
          <button style={s.crumbLink} onClick={() => navigate(-1)}>Filters</button>
          <span style={s.crumbSep}>›</span>
          <span style={s.crumbCurrent}>Bulk Operation</span>
        </span>, slotEl)}

      <div style={s.layout}>
        {/* Step rail */}
        <aside style={s.rail}>
          <button type="button" style={s.railTitle} title="Back to Filters" onClick={() => navigate(-1)}>Bulk Operation</button>
          {STEPS.map((label, i) => {
            const canGoBack = i < step; // only navigate BACK to already-completed steps
            return (
              <button key={label} type="button" disabled={!canGoBack} className={canGoBack ? 'wg-rail-link' : undefined}
                onClick={() => { if (canGoBack) { setError(''); setStep(i); } }}
                style={{ ...s.railStep, ...(i === step ? s.railActive : (i < step ? s.railDone : s.railFuture)),
                  cursor: canGoBack ? 'pointer' : 'default' }}>
                <span style={{ ...s.railDot, ...(i === step ? s.railDotActive : (i < step ? s.railDotDone : {})) }} />
                <span className="wg-rail-label">{label}</span>
                {i === 0 && step > 0 && <div style={s.railSub}>Selected {chosen.length} work item{chosen.length === 1 ? '' : 's'}</div>}
              </button>
            );
          })}
        </aside>

        {/* Main panel */}
        <div style={s.main}>
          <h2 style={s.h2}>Step {step + 1} of {STEPS.length}: {['Choose work items', 'Choose bulk action', 'Operation Details', 'Confirmation'][step]}</h2>
          {error && <div style={s.err}>{error}</div>}

          {step === 0 && (
            <>
              <table style={s.table}>
                <thead><tr><Th w={36} /><Th>Key</Th><Th>Summary</Th><Th>Status</Th><Th>Assignee</Th><Th>Priority</Th></tr></thead>
                <tbody>
                  {items.map((t) => (
                    <tr key={t._id} style={s.row}>
                      <Td><input type="checkbox" checked={t._sel} onChange={() => toggle(t._id)} /></Td>
                      <Td><span style={s.key}>{t.key}</span></Td>
                      <Td>{t.title}</Td>
                      <Td><span style={s.muted}>{t.status}</span></Td>
                      <Td><span style={s.muted}>{t.assignee_id ? userName(t.assignee_id) : 'Unassigned'}</span></Td>
                      <Td><span style={s.muted}>{cap(t.priority) || '—'}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Footer onNext={next} nextLabel="Next" />
            </>
          )}

          {step === 1 && (
            <>
              <p style={s.p}>Choose which action you'd like to take on the selected work items.</p>
              {[{ v: 'edit', t: 'Edit Work items', d: 'Edit field values of work items' },
                { v: 'delete', t: 'Delete Work items', d: 'Permanently delete work items' }].map((o) => (
                <label key={o.v} style={s.opRow}>
                  <input type="radio" name="op" checked={operation === o.v} onChange={() => setOperation(o.v)} />
                  <span style={s.opTitle}>{o.t}</span>
                  <span style={s.opDesc}>{o.d}</span>
                </label>
              ))}
              <Footer onBack={back} onNext={next} nextLabel="Next" />
            </>
          )}

          {step === 2 && (
            <>
              {operation === 'delete' ? (
                <p style={s.p}>All <b>{chosen.length}</b> selected work item{chosen.length === 1 ? '' : 's'} will be permanently deleted.</p>
              ) : (
                <>
                  <p style={s.p}>Choose the field(s) you wish to change on the selected <b>{chosen.length}</b> work item{chosen.length === 1 ? '' : 's'}.</p>
                  <div style={s.fieldRow}>
                    <input type="checkbox" checked={edit.priorityOn} onChange={(e) => setEdit((v) => ({ ...v, priorityOn: e.target.checked }))} />
                    <span style={s.fieldLbl}>Change Priority</span>
                    <span style={{ width: 220 }}><Select value={edit.priority} onChange={(v) => setEdit((x) => ({ ...x, priorityOn: true, priority: v }))}
                      options={PRIORITIES.map((p) => ({ value: p, label: cap(p) }))} /></span>
                  </div>
                  <div style={s.fieldRow}>
                    <input type="checkbox" checked={edit.assigneeOn} onChange={(e) => setEdit((v) => ({ ...v, assigneeOn: e.target.checked }))} />
                    <span style={s.fieldLbl}>Change Assignee</span>
                    <span style={{ width: 220 }}><Select value={edit.assignee} onChange={(v) => setEdit((x) => ({ ...x, assigneeOn: true, assignee: v }))}
                      options={[{ value: '', label: 'Unassigned' }, ...users.map((u) => ({ value: u.user_id, label: u.full_name || u.email }))]} /></span>
                  </div>
                  <div style={s.fieldRow}>
                    <input type="checkbox" checked={edit.reporterOn} onChange={(e) => setEdit((v) => ({ ...v, reporterOn: e.target.checked }))} />
                    <span style={s.fieldLbl}>Change Reporter</span>
                    <span style={{ width: 220 }}><Select value={edit.reporter} onChange={(v) => setEdit((x) => ({ ...x, reporterOn: true, reporter: v }))}
                      options={[{ value: '', label: 'None' }, ...users.map((u) => ({ value: u.user_id, label: u.full_name || u.email }))]} /></span>
                  </div>
                  <div style={s.fieldRow}>
                    <input type="checkbox" checked={edit.dueOn} onChange={(e) => setEdit((v) => ({ ...v, dueOn: e.target.checked }))} />
                    <span style={s.fieldLbl}>Change Due date</span>
                    <input type="date" style={s.date} value={edit.due} onChange={(e) => setEdit((x) => ({ ...x, dueOn: true, due: e.target.value }))} />
                  </div>
                  <div style={{ ...s.fieldRow, alignItems: 'flex-start' }}>
                    <input type="checkbox" style={{ marginTop: 8 }} checked={edit.labelsOn} onChange={(e) => setEdit((v) => ({ ...v, labelsOn: e.target.checked }))} />
                    <span style={{ ...s.fieldLbl, marginTop: 6 }}>Change Labels</span>
                    <span style={{ flex: 1, maxWidth: 320 }}>
                      <LabelPicker value={edit.labels} onChange={(labels) => setEdit((x) => ({ ...x, labelsOn: true, labels }))} />
                      <div style={s.hint}>Added to each task's existing labels.</div>
                    </span>
                  </div>
                </>
              )}
              <Footer onBack={back} onNext={next} nextLabel="Next" />
            </>
          )}

          {step === 3 && (
            <>
              <h3 style={s.h3}>{operation === 'delete' ? 'Confirm deletion' : 'Updated Fields'}</h3>
              {changes.length > 0 ? (
                <table style={s.table}>
                  <thead><tr><Th>Field Name</Th><Th>Field Action</Th><Th>Field Value</Th></tr></thead>
                  <tbody>{changes.map((c) => (
                    <tr key={c.name} style={s.row}><Td><b>{c.name}</b></Td><Td>{c.action}</Td><Td>{c.value}</Td></tr>
                  ))}</tbody>
                </table>
              ) : <p style={s.p}>No changes selected — go back and pick at least one field.</p>}
              <p style={s.p}>The above summarizes the changes for the following <b>{chosen.length}</b> work item{chosen.length === 1 ? '' : 's'}. Do you wish to continue?</p>
              <div style={s.footer}>
                <button type="button" className="btn" style={s.btn} onClick={back}>Back</button>
                <button type="button" className="btn btn-primary" style={s.btnPrimary}
                  disabled={busy || (operation === 'edit' && changes.length === 0)} onClick={confirm}>{busy ? 'Working…' : 'Confirm'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Footer({ onBack, onNext, nextLabel }) {
  return (
    <div style={s.footer}>
      {onBack && <button type="button" className="btn" style={s.btn} onClick={onBack}>Back</button>}
      <button type="button" className="btn btn-primary" style={s.btnPrimary} onClick={onNext}>{nextLabel}</button>
    </div>
  );
}
const Th = ({ children, w }) => <th style={{ ...s.th, width: w }}>{children}</th>;
const Td = ({ children }) => <td style={s.td}>{children}</td>;

const s = {
  crumbs: { display: 'inline-flex', alignItems: 'center', gap: 8 },
  crumbLink: { background: 'none', border: 'none', color: 'var(--c-muted)', cursor: 'pointer', fontSize: 15, fontWeight: 600, padding: 0 },
  crumbSep: { color: 'var(--c-faint)', fontSize: 15 },
  crumbCurrent: { color: 'var(--c-text-strong)', fontSize: 15, fontWeight: 700 },
  layout: { display: 'flex', gap: 28, alignItems: 'flex-start' },
  rail: { width: 220, flexShrink: 0 },
  railTitle: { fontSize: 15, fontWeight: 700, color: 'var(--c-text-strong)', marginBottom: 14, background: 'none',
    border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' },
  hint: { fontSize: 12, color: 'var(--c-faint)', marginTop: 4 },
  railStep: { display: 'block', position: 'relative', width: '100%', textAlign: 'left', background: 'none', border: 'none',
    padding: '8px 0 8px 22px', fontSize: 14, color: 'var(--c-muted)', font: 'inherit' },
  railActive: { color: 'var(--c-text-strong)', fontWeight: 700 },
  railDone: { color: 'var(--c-primary)', fontWeight: 500 },   // completed → blue link (clickable back)
  railFuture: { color: 'var(--c-faint)' },                    // not reached yet → muted
  railSub: { fontSize: 12, color: 'var(--c-faint)', marginTop: 2 },
  railDot: { position: 'absolute', left: 0, top: 12, width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--c-border)' },
  railDotActive: { borderColor: 'var(--c-primary)', background: 'var(--c-primary)' },
  railDotDone: { borderColor: 'var(--c-primary)' },
  main: { flex: 1, minWidth: 0 },
  h2: { margin: '0 0 14px', fontSize: 22, color: 'var(--c-text-strong)' },
  h3: { margin: '0 0 10px', fontSize: 17, color: 'var(--c-text-strong)' },
  p: { fontSize: 14, color: 'var(--c-text)', margin: '0 0 14px' },
  err: { background: 'color-mix(in srgb, #dc2626 12%, transparent)', color: '#b91c1c', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 14 },
  table: { width: '100%', borderCollapse: 'collapse', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 },
  th: { textAlign: 'left', padding: '10px 14px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--c-muted)', background: 'var(--c-surface-2)' },
  td: { padding: '11px 14px', fontSize: 14, color: 'var(--c-text)', borderTop: '1px solid var(--c-border-2)', verticalAlign: 'middle' },
  row: {},
  key: { color: 'var(--c-primary)', fontWeight: 700, fontSize: 13 },
  muted: { color: 'var(--c-muted)', fontSize: 13 },
  opRow: { display: 'grid', gridTemplateColumns: '22px 200px 1fr', alignItems: 'center', gap: 8, padding: '10px 4px', cursor: 'pointer', borderTop: '1px solid var(--c-border-2)' },
  opTitle: { fontSize: 14, fontWeight: 600, color: 'var(--c-text-strong)' },
  opDesc: { fontSize: 13.5, color: 'var(--c-muted)' },
  fieldRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', maxWidth: 520 },
  fieldLbl: { width: 160, fontSize: 14, color: 'var(--c-text)' },
  date: { padding: '8px 10px', border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)', color: 'var(--c-text)' },
  footer: { display: 'flex', gap: 10, marginTop: 18 },
  btn: { fontSize: 14, padding: '9px 18px' },
  btnPrimary: { fontSize: 14, fontWeight: 600, padding: '9px 20px' },
};
