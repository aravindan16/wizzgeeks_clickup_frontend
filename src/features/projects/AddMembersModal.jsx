import { useEffect, useState } from 'react';
import { projectsApi } from './projectsApi';
import { dashboardsApi } from '../dashboard/dashboardsApi';
import { useToast } from '../../components/Toast';

/**
 * "Add people to <Space>" modal (Jira-style): type a name/email to find existing
 * users, pick selected people as chips, choose a Role (with descriptions), and Add.
 * No external "add from Google/Slack/Microsoft" providers.
 */
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export default function AddMembersModal({ open, project, projectId, existingMemberIds, onClose, onAdded }) {
  const toast = useToast();
  const [results, setResults] = useState([]); // {_id, full_name, email} from the directory search
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]); // [{id,name,email}]
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (open) { setQuery(''); setSelected([]); setError(null); setResults([]); } }, [open]);

  // Search the user directory as you type via an AUTH-ONLY endpoint, so managing space
  // members doesn't require the broader `user.read` permission (a space manager who
  // lacks user.read can still find and add people).
  useEffect(() => {
    if (!open) return undefined;
    const term = query.trim();
    if (!term) { setResults([]); return undefined; }
    let alive = true;
    const t = setTimeout(() => {
      dashboardsApi.searchUsers(term)
        .then((r) => {
          const items = Array.isArray(r) ? r : (r?.items || []);
          if (alive) setResults(items.map((u) => ({ _id: u.user_id, full_name: u.full_name, email: u.email })));
        })
        .catch(() => { if (alive) setResults([]); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [query, open]);

  if (!open) return null;

  const selectedIds = new Set(selected.map((s) => s.id));
  const q = query.trim().toLowerCase();
  // Server already matched by the query; just hide existing members / already-picked.
  const matches = q
    ? results.filter((u) => !existingMemberIds.has(u._id) && !selectedIds.has(u._id)).slice(0, 6)
    : [];

  const addChip = (u) => { setSelected((s) => [...s, { id: u._id, name: u.full_name, email: u.email }]); setQuery(''); };
  const addEmailChip = (email) => {
    const e = email.trim().toLowerCase();
    if (selected.some((x) => (x.email || '').toLowerCase() === e)) { setQuery(''); return; }
    setSelected((s) => [...s, { id: null, name: e, email: e }]); // resolved server-side on Add
    setQuery('');
  };
  const removeChip = (key) => setSelected((s) => s.filter((x) => (x.id || x.email) !== key));

  const onInputKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matches.length === 1) addChip(matches[0]);
      else if (isEmail(query)) addEmailChip(query);
    }
  };

  const submit = async () => {
    if (selected.length === 0) { setError('Add at least one person.'); return; }
    setSaving(true); setError(null);
    try {
      for (const person of selected) {
        // No role chosen here — the backend assigns the default member role.
        const payload = person.id
          ? { user_id: person.id }
          : { email: person.email };
        await projectsApi.addMember(projectId, payload);
      }
      toast.success(`Added ${selected.length} ${selected.length === 1 ? 'person' : 'people'}`);
      onAdded?.();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not add members');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={ov.backdrop} onClick={onClose}>
      <div style={ov.modal} onClick={(e) => e.stopPropagation()}>
        <div style={ov.head}>
          <h3 style={{ margin: 0 }}>Add people to {project?.name}</h3>
          <button className="icon-btn" style={ov.close} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <label style={ov.label}>Names or emails <span style={{ color: '#b91c1c' }}>*</span></label>
        <div style={ov.inputWrap}>
          {selected.length > 0 && (
            <div style={ov.chips}>
              {selected.map((p) => (
                <span key={p.id || p.email} style={ov.chip}>
                  {p.name}
                  <button style={ov.chipX} onClick={() => removeChip(p.id || p.email)}>✕</button>
                </span>
              ))}
            </div>
          )}
          <input style={ov.input} autoFocus value={query}
            onChange={(e) => setQuery(e.target.value)} onKeyDown={onInputKey}
            placeholder="e.g., Maria, maria@company.com" />
          {matches.length > 0 && (
            <div style={ov.results}>
              {matches.map((u) => (
                <button key={u._id} style={ov.result} onClick={() => addChip(u)}>
                  <span style={ov.avatar}>{(u.full_name || '?')[0]}</span>
                  <span>
                    <div style={{ fontWeight: 600 }}>{u.full_name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{u.email}</div>
                  </span>
                </button>
              ))}
            </div>
          )}
          {q && matches.length === 0 && isEmail(query) && (
            <div style={ov.results}>
              <button style={ov.result} onClick={() => addEmailChip(query)}>
                <span style={ov.avatar}>@</span>
                <span><div style={{ fontWeight: 600 }}>Add “{query.trim()}”</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Add by email (must be an existing user)</div></span>
              </button>
            </div>
          )}
          {q && matches.length === 0 && !isEmail(query) && (
            <div style={ov.noMatch}>No matching user. Type a full email to add by email.</div>
          )}
        </div>
        <div style={ov.hint}>Search by name, enter an email, or paste a list</div>

        {error && <p style={{ color: '#991b1b', fontSize: 13, marginTop: 10 }}>{error}</p>}

        <div style={ov.footer}>
          <button style={ov.ghost} onClick={onClose}>Cancel</button>
          <button style={ov.primary} onClick={submit} disabled={saving || selected.length === 0}>
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

const ov = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex',
    alignItems: 'flex-start', justifyContent: 'center', zIndex: 60, padding: '8vh 16px' },
  modal: { background: 'var(--c-surface)', color: 'var(--c-text)', borderRadius: 12, padding: 24, width: 460, maxWidth: '95vw' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  close: { border: 'none', fontSize: 16, color: 'var(--c-muted)', cursor: 'pointer' },
  label: { display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--c-text-strong)' },
  inputWrap: { position: 'relative' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  chip: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--c-surface-3)', color: 'var(--c-text)',
    borderRadius: 999, padding: '3px 10px', fontSize: 13 },
  chipX: { background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 11 },
  input: { width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 14 },
  results: { position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--c-surface)', border: '1px solid var(--c-border)',
    borderRadius: 8, boxShadow: '0 10px 28px rgba(0,0,0,.15)', zIndex: 5, marginTop: 4, overflow: 'hidden' },
  result: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px',
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--c-text)' },
  avatar: { width: 28, height: 28, borderRadius: '50%', background: '#f59e0b', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 },
  noMatch: { position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--c-surface)', border: '1px solid var(--c-border)',
    borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--c-muted)', marginTop: 4, zIndex: 5 },
  hint: { fontSize: 12, color: 'var(--c-muted)', marginTop: 6 },
  roleBtn: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
    padding: '11px 12px', border: '1px solid #111827', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14 },
  roleMenu: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,.18)', zIndex: 6, marginTop: 4, overflow: 'hidden', maxHeight: 280, overflowY: 'auto' },
  roleOption: { display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
    padding: '10px 14px', cursor: 'pointer', borderLeft: '3px solid transparent' },
  roleOptionActive: { background: '#f3f4f6', borderLeft: '3px solid #111827' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 },
  primary: { padding: '9px 20px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  ghost: { padding: '9px 18px', background: 'var(--c-surface)', color: 'var(--c-text)', border: '1px solid var(--c-border)', borderRadius: 8, cursor: 'pointer' },
};
