import { createPortal } from 'react-dom';
import { Users as UsersIcon } from 'lucide-react';
import { IconClose } from '../../components/icons';

const initials = (n) => (n || '?').split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/** Pick a conversation to forward a message into. */
export default function ForwardModal({ open, conversations, message, onPick, onClose }) {
  if (!open) return null;
  return createPortal(
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <strong style={s.title}>Forward message</strong>
          <button className="icon-btn" style={s.close} onClick={onClose} title="Close"><IconClose size={16} /></button>
        </div>
        {message && <div style={s.preview}>“{message.body}”</div>}
        <div style={s.list}>
          {conversations.length === 0 && <div style={s.empty}>No conversations.</div>}
          {conversations.map((c) => (
            <button key={c.id} className="wg-row-hover" style={s.row} onClick={() => onPick(c.id)}>
              {c.type === 'group'
                ? <span style={{ ...s.avatar, background: 'var(--c-primary-weak)', color: 'var(--c-primary)' }}><UsersIcon size={16} /></span>
                : <span style={{ ...s.avatar, ...(c.avatar_color ? { background: c.avatar_color } : {}) }}>
                    {c.avatar_url ? <img src={c.avatar_url} alt="" style={s.img} /> : initials(c.name)}
                  </span>}
              <span style={s.name}>{c.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 2200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '10vh 16px' },
  modal: { width: 400, maxWidth: '95vw', maxHeight: '70vh', background: 'var(--c-surface)', color: 'var(--c-text)', borderRadius: 12, boxShadow: '0 24px 64px rgba(16,24,40,.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--c-border)' },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--c-text-strong)' },
  close: { width: 30, height: 30, color: 'var(--c-muted)' },
  preview: { padding: '10px 16px', fontSize: 13, color: 'var(--c-muted)', borderBottom: '1px solid var(--c-border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  list: { flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 },
  empty: { padding: 24, textAlign: 'center', color: 'var(--c-faint)', fontSize: 13 },
  row: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'none', cursor: 'pointer', padding: '9px 10px', borderRadius: 8, textAlign: 'left' },
  avatar: { width: 34, height: 34, borderRadius: '50%', background: '#f59e0b', color: '#fff', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, overflow: 'hidden' },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  name: { fontSize: 14, fontWeight: 600, color: 'var(--c-text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
};
