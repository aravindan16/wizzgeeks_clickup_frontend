import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Users as UsersIcon, Check, Forward } from 'lucide-react';
import { IconClose } from '../../components/icons';

const initials = (n) => (n || '?').split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/** Pick one or more conversations to forward one or more messages into. */
export default function ForwardModal({ open, conversations, messages, onSubmit, onClose }) {
  const [picked, setPicked] = useState([]);
  useEffect(() => { if (open) setPicked([]); }, [open]);
  if (!open) return null;

  const list = messages || [];
  const first = list[0];
  const label = list.length > 1 ? `${list.length} messages` : (first?.body || (first?.attachment ? first.attachment.name || 'Attachment' : 'Message'));
  const toggle = (id) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return createPortal(
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <strong style={s.title}>Forward to…</strong>
          <button className="icon-btn" style={s.close} onClick={onClose} title="Close"><IconClose size={16} /></button>
        </div>
        <div style={s.preview}>Forwarding: “{label}”</div>
        <div style={s.list}>
          {conversations.length === 0 && <div style={s.empty}>No conversations.</div>}
          {conversations.map((c) => {
            const on = picked.includes(c.id);
            return (
              <button key={c.id} className="wg-row-hover" style={s.row} onClick={() => toggle(c.id)}>
                {c.type === 'group'
                  ? (c.avatar_url
                    ? <span style={s.avatar}><img src={c.avatar_url} alt="" style={s.img} /></span>
                    : <span style={{ ...s.avatar, background: 'var(--c-primary-weak)', color: 'var(--c-primary)' }}><UsersIcon size={16} /></span>)
                  : <span style={{ ...s.avatar, ...(c.avatar_color ? { background: c.avatar_color } : {}) }}>
                      {c.avatar_url ? <img src={c.avatar_url} alt="" style={s.img} /> : initials(c.name)}
                    </span>}
                <span style={s.name}>{c.name}</span>
                <span style={{ ...s.check, ...(on ? s.checkOn : {}) }}>{on && <Check size={13} strokeWidth={3} />}</span>
              </button>
            );
          })}
        </div>
        <div style={s.footer}>
          <button className="btn" style={s.cancel} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={s.send} disabled={!picked.length} onClick={() => onSubmit(picked)}>
            <Forward size={15} /> Forward{picked.length ? ` (${picked.length})` : ''}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 2200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '10vh 16px' },
  modal: { width: 400, maxWidth: '95vw', maxHeight: '76vh', background: 'var(--c-surface)', color: 'var(--c-text)', borderRadius: 12, boxShadow: '0 24px 64px rgba(16,24,40,.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--c-border)' },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--c-text-strong)' },
  close: { width: 30, height: 30, color: 'var(--c-muted)' },
  preview: { padding: '10px 16px', fontSize: 13, color: 'var(--c-muted)', borderBottom: '1px solid var(--c-border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  list: { flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 },
  empty: { padding: 24, textAlign: 'center', color: 'var(--c-faint)', fontSize: 13 },
  row: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'none', cursor: 'pointer', padding: '9px 10px', borderRadius: 8, textAlign: 'left' },
  avatar: { width: 34, height: 34, borderRadius: '50%', background: '#f59e0b', color: '#fff', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, overflow: 'hidden' },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  name: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--c-text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  check: { width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--c-border)', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-on-primary)' },
  checkOn: { background: 'var(--c-primary)', borderColor: 'var(--c-primary)' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--c-border)' },
  cancel: { fontSize: 13, padding: '8px 14px' },
  send: { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, padding: '8px 16px' },
};
