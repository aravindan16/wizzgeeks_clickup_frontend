import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from './projectsApi';
import { DEFAULT_SPACE_STATUSES } from '../tasks/tasksApi';
import { useToast } from '../../components/Toast';
import StatusEditor from './StatusEditor';
import { Chevron } from '../../components/icons';

/**
 * "Let's set up your space" — Jira-style create flow. Space name is the primary
 * input; the key is auto-suggested from it. Work types / Statuses / Views are
 * shown as the building blocks (informational, Jira-style).
 */
const WORK_TYPES = ['Task', 'Bug'];
const STATUSES = ['To Do', 'In Progress', 'In Review', 'Done'];
const VIEWS = ['Board'];

function suggestKey(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  let key = words.length > 1
    ? words.map((w) => w[0]).join('')           // initials for multi-word
    : (words[0] || '').slice(0, 4);             // first letters for single word
  key = key.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10);
  return key.length >= 2 ? key : (key + 'KEY').slice(0, 3);
}

export default function SpaceSetupModal({ open, onClose, onCreated }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [section, setSection] = useState(null); // expanded info section
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statuses, setStatuses] = useState(DEFAULT_SPACE_STATUSES);
  const [editStatuses, setEditStatuses] = useState(false);

  useEffect(() => {
    if (open) {
      setName(''); setKey(''); setKeyEdited(false); setDescription('');
      setSection(null); setError(null);
      setStatuses(DEFAULT_SPACE_STATUSES); setEditStatuses(false);
    }
  }, [open]);

  // Auto-suggest the key from the name until the user edits it manually.
  useEffect(() => {
    if (!keyEdited) setKey(suggestKey(name));
  }, [name, keyEdited]);

  if (!open) return null;

  const create = async (e) => {
    e.preventDefault();
    setError(null); setSaving(true);
    try {
      const space = await projectsApi.create({
        key, name, description: description || null, statuses,
      });
      toast.success('Space created');
      onCreated?.();
      onClose?.();               // close the modal (esp. when opened from the persistent sidebar)
      navigate(`/projects/${space._id}`);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Could not create space');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={ov.backdrop} onClick={onClose}>
      <div style={ov.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 4px' }}>Let’s set up your space</h2>
        <p style={{ color: 'var(--c-muted)', marginTop: 0 }}>
          These form the building blocks of your space. You can change these settings later.
        </p>

        <form onSubmit={create}>
          <Field label="Space name">
            <input style={ov.input} value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wizzgeeks development team" required autoFocus />
          </Field>

          <Field label="Description (optional)">
            <textarea style={{ ...ov.input, minHeight: 56 }} value={description}
              onChange={(e) => setDescription(e.target.value)} />
          </Field>

          {/* Building blocks (informational, collapsible like Jira) */}
          <Block title="Work types" value={WORK_TYPES.join(', ')}
            open={section === 'work'} onToggle={() => setSection(section === 'work' ? null : 'work')}>
            {WORK_TYPES.map((w) => <Chip key={w}>{w}</Chip>)}
          </Block>
          <div style={ov.block}>
            <div style={ov.statusHead}>
              <span>
                <strong>Statuses</strong>
                <div style={{ color: 'var(--c-muted)', fontSize: 13 }}>{statuses.map((s) => s.name).join(', ')}</div>
              </span>
              <button type="button" style={ov.editBtn} onClick={() => setEditStatuses(true)}>Customize</button>
            </div>
            <div style={ov.chips}>
              {statuses.map((st) => (
                <span key={st.key || st.name} style={{ ...ov.statusChip, borderColor: st.color, color: st.color }}>
                  <span style={{ ...ov.statusDot, background: st.color }} /> {st.name}
                </span>
              ))}
            </div>
          </div>
          <Block title="Views" value={VIEWS.join(', ')}
            open={section === 'views'} onToggle={() => setSection(section === 'views' ? null : 'views')}>
            {VIEWS.map((v) => <Chip key={v}>{v}</Chip>)}
          </Block>

          {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}

          <div style={ov.footer}>
            <button type="button" style={ov.ghost} onClick={onClose}>Cancel</button>
            <button type="submit" style={ov.primary} disabled={saving}>
              {saving ? 'Creating…' : 'Create space'}
            </button>
          </div>
        </form>
      </div>

      <StatusEditor open={editStatuses} initial={statuses}
        onClose={() => setEditStatuses(false)} onApply={setStatuses} />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

function Block({ title, value, open, onToggle, children }) {
  return (
    <div style={ov.block}>
      <button type="button" style={ov.blockHead} onClick={onToggle}>
        <span>
          <strong>{title}</strong>
          <div style={{ color: 'var(--c-muted)', fontSize: 13 }}>{value}</div>
        </span>
        <span style={{ color: 'var(--c-faint)', display: 'inline-flex' }}><Chevron open={open} size={14} /></span>
      </button>
      {open && <div style={ov.chips}>{children}</div>}
    </div>
  );
}

const Chip = ({ children }) => <span style={ov.chip}>{children}</span>;

const ov = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 },
  modal: { background: 'var(--c-surface)', color: 'var(--c-text)', borderRadius: 12, padding: 24, width: 520, maxWidth: '95vw',
    maxHeight: '92vh', overflowY: 'auto' },
  input: { padding: '10px 12px', border: '1px solid var(--c-border)', borderRadius: 8, width: '100%', boxSizing: 'border-box',
    background: 'var(--c-surface)', color: 'var(--c-text)' },
  block: { border: '1px solid var(--c-border)', borderRadius: 10, marginBottom: 10 },
  blockHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
    background: 'none', border: 'none', padding: '12px 14px', cursor: 'pointer', textAlign: 'left', color: 'var(--c-text)' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 14px 12px' },
  chip: { fontSize: 13, background: 'var(--c-surface-3)', color: 'var(--c-text)', borderRadius: 999, padding: '3px 10px' },
  statusHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px' },
  editBtn: { background: 'var(--c-surface)', color: 'var(--c-text)', border: '1px solid var(--c-border)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  statusChip: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
    background: 'var(--c-surface)', border: '1px solid', borderRadius: 999, padding: '3px 10px' },
  statusDot: { width: 9, height: 9, borderRadius: '50%' },
  toggleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', marginTop: 4, fontSize: 14 },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  primary: { padding: '10px 18px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
  ghost: { padding: '10px 18px', background: 'var(--c-surface)', color: 'var(--c-text)', border: '1px solid var(--c-border)', borderRadius: 8, cursor: 'pointer' },
};
