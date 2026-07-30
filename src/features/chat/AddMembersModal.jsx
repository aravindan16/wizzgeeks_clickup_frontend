import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search } from 'lucide-react';
import { IconClose } from '../../components/icons';
import { useToast } from '../../components/Toast';
import { chatApi } from './chatApi';

const initials = (n) => (n || '?').split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/** Pick people (not already in the group) and add them to the conversation. */
export default function AddMembersModal({ open, convId, existingIds = [], onAdded, onClose }) {
  const toast = useToast();
  const [contacts, setContacts] = useState([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ(''); setSelected(new Set());
    chatApi.contacts().then(setContacts).catch(() => setContacts([]));
  }, [open]);

  const existing = useMemo(() => new Set(existingIds.map(String)), [existingIds]);
  const filtered = useMemo(() => contacts.filter((c) =>
    !existing.has(String(c.id))
    && `${c.name || ''} ${c.email || ''}`.toLowerCase().includes(q.toLowerCase())), [contacts, existing, q]);

  if (!open) return null;

  const toggle = (id) => setSelected((cur) => {
    const next = new Set(cur);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const submit = async () => {
    if (!selected.size) return;
    setBusy(true);
    try {
      const conv = await chatApi.addMembers(convId, [...selected]);
      onAdded(conv);
    } catch (e) { toast.error(e.response?.data?.error?.message || 'Could not add members'); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <strong style={s.title}>Add members</strong>
          <button className="icon-btn" style={s.close} onClick={onClose} title="Close"><IconClose size={16} /></button>
        </div>
        <div style={s.searchRow}>
          <Search size={15} />
          <input style={s.search} placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        <div style={s.list}>
          {filtered.length === 0 && <div style={s.empty}>No people to add.</div>}
          {filtered.map((c) => {
            const on = selected.has(c.id);
            return (
              <button key={c.id} className="wg-row-hover" style={s.contact} onClick={() => toggle(c.id)}>
                <span style={{ ...s.avatar, ...(c.avatar_color ? { background: c.avatar_color } : {}) }}>
                  {c.avatar_url ? <img src={c.avatar_url} alt="" style={s.avatarImg} /> : initials(c.name)}
                </span>
                <span style={s.cinfo}>
                  <span style={s.cname}>{c.name}</span>
                  <span style={s.cemail}>{c.email}</span>
                </span>
                <span style={{ ...s.check, ...(on ? s.checkOn : {}) }}>{on && <Check size={13} strokeWidth={3} />}</span>
              </button>
            );
          })}
        </div>
        <div style={s.footer}>
          <button className="btn" style={s.cancel} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={s.add} disabled={!selected.size || busy} onClick={submit}>
            Add{selected.size ? ` (${selected.size})` : ''}
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
  searchRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--c-border)', color: 'var(--c-muted)' },
  search: { flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--c-text)', fontSize: 14 },
  list: { flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 },
  empty: { padding: 24, textAlign: 'center', color: 'var(--c-faint)', fontSize: 13 },
  contact: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', cursor: 'pointer', padding: '9px 10px', borderRadius: 8, textAlign: 'left' },
  avatar: { width: 36, height: 36, borderRadius: '50%', background: '#f59e0b', color: '#fff', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cinfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  cname: { fontSize: 14, fontWeight: 600, color: 'var(--c-text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cemail: { fontSize: 12, color: 'var(--c-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  check: { width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--c-border)', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-on-primary)' },
  checkOn: { background: 'var(--c-primary)', borderColor: 'var(--c-primary)' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--c-border)' },
  cancel: { fontSize: 13, padding: '8px 14px' },
  add: { fontSize: 13, padding: '8px 16px' },
};
