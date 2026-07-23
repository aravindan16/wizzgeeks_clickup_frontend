import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2 } from 'lucide-react';
import { IconClose } from '../../components/icons';
import { useToast } from '../../components/Toast';

/** Create a poll: a question + 2–12 options, single or multiple choice. */
export default function NewPollModal({ open, onClose, onCreate }) {
  const toast = useToast();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multi, setMulti] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setQuestion(''); setOptions(['', '']); setMulti(false); setBusy(false); }
  }, [open]);

  if (!open) return null;

  const setOpt = (i, v) => setOptions((o) => o.map((x, j) => (j === i ? v : x)));
  const addOpt = () => setOptions((o) => (o.length >= 12 ? o : [...o, '']));
  const delOpt = (i) => setOptions((o) => (o.length <= 2 ? o : o.filter((_, j) => j !== i)));

  const create = async () => {
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim()) return toast.error('Enter a question');
    if (opts.length < 2) return toast.error('Add at least two options');
    setBusy(true);
    try { await onCreate(question.trim(), opts, multi); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <strong style={s.title}>Create poll</strong>
          <button className="icon-btn" style={s.close} onClick={onClose} title="Close"><IconClose size={16} /></button>
        </div>
        <div style={s.body}>
          <label style={s.label}>Question</label>
          <input style={s.input} placeholder="Ask something…" value={question} onChange={(e) => setQuestion(e.target.value)} autoFocus />
          <label style={{ ...s.label, marginTop: 14 }}>Options</label>
          {options.map((o, i) => (
            <div key={i} style={s.optRow}>
              <input style={{ ...s.input, flex: 1 }} placeholder={`Option ${i + 1}`} value={o} onChange={(e) => setOpt(i, e.target.value)} />
              {options.length > 2 && (
                <button className="icon-btn" style={s.optDel} onClick={() => delOpt(i)} title="Remove"><Trash2 size={15} /></button>
              )}
            </div>
          ))}
          {options.length < 12 && (
            <button type="button" style={s.addOpt} onClick={addOpt}><Plus size={15} /> Add option</button>
          )}
          <label style={s.multiRow}>
            <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} />
            Allow multiple answers
          </label>
        </div>
        <div style={s.footer}>
          <button className="btn" style={s.cancel} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={s.create} disabled={busy} onClick={create}>Create poll</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 2200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 16px' },
  modal: { width: 440, maxWidth: '95vw', maxHeight: '82vh', background: 'var(--c-surface)', color: 'var(--c-text)', borderRadius: 12, boxShadow: '0 24px 64px rgba(16,24,40,.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--c-border)' },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--c-text-strong)' },
  close: { width: 30, height: 30, color: 'var(--c-muted)' },
  body: { padding: 16, overflowY: 'auto' },
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--c-text-strong)', marginBottom: 6 },
  input: { width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 14, background: 'var(--c-surface)', color: 'var(--c-text)' },
  optRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 },
  optDel: { width: 32, height: 32, color: 'var(--c-danger, #dc2626)', flexShrink: 0 },
  addOpt: { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px dashed var(--c-border)', background: 'none', color: 'var(--c-primary)', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  multiRow: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13.5, color: 'var(--c-text)', cursor: 'pointer' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--c-border)' },
  cancel: { padding: '9px 16px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text)', borderRadius: 8, cursor: 'pointer' },
  create: { padding: '9px 18px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
};
