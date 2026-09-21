import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Users as UsersIcon, Check, Forward, Search } from 'lucide-react';
import { IconClose } from '../../components/icons';
import { chatApi } from './chatApi';

const initials = (n) => (n || '?').split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/** Pick existing chats and/or new people to forward one or more messages to. */
export default function ForwardModal({ open, conversations, messages, onSubmit, onClose }) {
  const [picked, setPicked] = useState([]); // array of "conv:<id>" / "user:<id>"
  const [contacts, setContacts] = useState([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) return;
    setPicked([]); setQ('');
    chatApi.contacts().then(setContacts).catch(() => setContacts([]));
  }, [open]);

  // People who already have a direct chat — hide them from "New people" (their chat is listed above).
  const directOtherIds = useMemo(() => {
    const s = new Set();
    (conversations || []).forEach((c) => {
      if (c.type === 'direct') (c.members || []).forEach((m) => s.add(String(m.id)));
    });
    return s;
  }, [conversations]);

  if (!open) return null;

  const list = messages || [];
  const first = list[0];
  const label = list.length > 1 ? `${list.length} messages` : (first?.body || (first?.attachment ? first.attachment.name || 'Attachment' : 'Message'));
  const ql = q.toLowerCase();
  const chats = (conversations || []).filter((c) => (c.name || '').toLowerCase().includes(ql));
  const people = contacts.filter((c) => !directOtherIds.has(String(c.id))
    && `${c.name || ''} ${c.email || ''}`.toLowerCase().includes(ql));

  const toggle = (key) => setPicked((cur) => (cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key]));
  const submit = () => onSubmit(picked.map((k) => {
    const [kind, id] = k.split(/:(.+)/);
    return { kind: kind === 'conv' ? 'conv' : 'user', id };
  }));

  const Row = ({ keyId, avatar, name, sub }) => {
    const on = picked.includes(keyId);
    return (
      <button type="button" className="wg-row-hover" style={s.row} onClick={() => toggle(keyId)}>
        {avatar}
        <span style={s.cinfo}>
          <span style={s.name}>{name}</span>
          {sub && <span style={s.sub}>{sub}</span>}
        </span>
        <span style={{ ...s.check, ...(on ? s.checkOn : {}) }}>{on && <Check size={13} strokeWidth={3} />}</span>
      </button>
    );
  };

  return createPortal(
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <strong style={s.title}>Forward to…</strong>
          <button className="icon-btn" style={s.close} onClick={onClose} title="Close"><IconClose size={16} /></button>
        </div>
        <div style={s.preview}>Forwarding: “{label}”</div>
        <div style={s.searchRow}>
          <Search size={15} />
          <input style={s.search} placeholder="Search chats or people…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        <div style={s.list}>
          {chats.length > 0 && <div style={s.group}>Chats</div>}
          {chats.map((c) => (
            <Row key={c.id} keyId={`conv:${c.id}`} name={c.name}
              avatar={c.type === 'group'
                ? (c.avatar_url
                  ? <span style={s.avatar}><img src={c.avatar_url} alt="" style={s.img} /></span>
                  : <span style={{ ...s.avatar, background: 'var(--c-primary-weak)', color: 'var(--c-primary)' }}><UsersIcon size={16} /></span>)
                : <span style={{ ...s.avatar, ...(c.avatar_color ? { background: c.avatar_color } : {}) }}>
                    {c.avatar_url ? <img src={c.avatar_url} alt="" style={s.img} /> : initials(c.name)}
                  </span>} />
          ))}
          {people.length > 0 && <div style={s.group}>New people</div>}
          {people.map((c) => (
            <Row key={c.id} keyId={`user:${c.id}`} name={c.name} sub={c.email}
              avatar={<span style={{ ...s.avatar, ...(c.avatar_color ? { background: c.avatar_color } : {}) }}>
                {c.avatar_url ? <img src={c.avatar_url} alt="" style={s.img} /> : initials(c.name)}
              </span>} />
          ))}
          {chats.length === 0 && people.length === 0 && <div style={s.empty}>No matches.</div>}
        </div>
        <div style={s.footer}>
          <button className="btn" style={s.cancel} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={s.send} disabled={!picked.length} onClick={submit}>
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
  searchRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--c-border)', color: 'var(--c-muted)' },
  search: { flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--c-text)', fontSize: 14 },
  list: { flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 },
  group: { padding: '8px 10px 4px', fontSize: 11, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: 0.4 },
  empty: { padding: 24, textAlign: 'center', color: 'var(--c-faint)', fontSize: 13 },
  row: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', cursor: 'pointer', padding: '9px 10px', borderRadius: 8, textAlign: 'left' },
  avatar: { width: 34, height: 34, borderRadius: '50%', background: '#f59e0b', color: '#fff', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, overflow: 'hidden' },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  cinfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  name: { fontSize: 14, fontWeight: 600, color: 'var(--c-text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sub: { fontSize: 12, color: 'var(--c-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  check: { width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--c-border)', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-on-primary)' },
  checkOn: { background: 'var(--c-primary)', borderColor: 'var(--c-primary)' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--c-border)' },
  cancel: { fontSize: 13, padding: '8px 14px' },
  send: { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, padding: '8px 16px' },
};
