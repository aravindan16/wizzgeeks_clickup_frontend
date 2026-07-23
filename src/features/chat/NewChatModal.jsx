import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconClose, IconSearch, IconCheck } from '../../components/icons';
import { useToast } from '../../components/Toast';
import { chatApi } from './chatApi';

const initials = (n) => (n || '?').split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/** Start a direct message or create a group chat by picking from the contacts directory. */
export default function NewChatModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [tab, setTab] = useState('direct');
  const [contacts, setContacts] = useState([]);
  const [q, setQ] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab('direct'); setQ(''); setGroupName(''); setSelected(new Set());
    chatApi.contacts().then(setContacts).catch(() => setContacts([]));
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return !s ? contacts : contacts.filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(s));
  }, [contacts, q]);

  if (!open) return null;

  const startDirect = async (c) => {
    if (busy) return;
    setBusy(true);
    try { onCreated(await chatApi.createDirect(c.id)); }
    catch (e) { toast.error(e.response?.data?.error?.message || 'Could not start chat'); }
    finally { setBusy(false); }
  };

  const toggle = (id) => setSelected((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const createGroup = async () => {
    if (busy) return;
    if (!groupName.trim()) return toast.error('Enter a group name');
    if (selected.size === 0) return toast.error('Select at least one member');
    setBusy(true);
    try { onCreated(await chatApi.createGroup(groupName.trim(), [...selected])); }
    catch (e) { toast.error(e.response?.data?.error?.message || 'Could not create group'); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.head}>
          <strong style={s.title}>New conversation</strong>
          <button className="icon-btn" style={s.close} onClick={onClose} title="Close"><IconClose size={16} /></button>
        </div>

        <div style={s.tabs}>
          <button style={{ ...s.tab, ...(tab === 'direct' ? s.tabOn : {}) }} onClick={() => setTab('direct')}>Direct message</button>
          <button style={{ ...s.tab, ...(tab === 'group' ? s.tabOn : {}) }} onClick={() => setTab('group')}>Group chat</button>
        </div>

        {tab === 'group' && (
          <input style={s.input} placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
        )}

        <div style={s.searchRow}>
          <IconSearch size={15} />
          <input style={s.search} placeholder="Search people…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>

        <div style={s.list}>
          {filtered.length === 0 && <div style={s.empty}>No people found.</div>}
          {filtered.map((c) => {
            const on = selected.has(c.id);
            return (
              <button key={c.id} className="wg-row-hover" style={s.contact}
                onClick={() => (tab === 'direct' ? startDirect(c) : toggle(c.id))}>
                <span style={{ ...s.avatar, ...(c.avatar_color ? { background: c.avatar_color } : {}) }}>
                  {c.avatar_url ? <img src={c.avatar_url} alt="" style={s.avatarImg} /> : initials(c.name)}
                </span>
                <span style={s.cinfo}>
                  <span style={s.cname}>{c.name}</span>
                  <span style={s.cemail}>{c.email}</span>
                </span>
                {tab === 'group' && (
                  <span style={{ ...s.check, ...(on ? s.checkOn : {}) }}>{on && <IconCheck size={13} />}</span>
                )}
              </button>
            );
          })}
        </div>

        {tab === 'group' && (
          <div style={s.footer}>
            <span style={s.selCount}>{selected.size} selected</span>
            <button className="btn btn-primary" style={s.create} disabled={busy} onClick={createGroup}>Create group</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 2100,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 16px' },
  modal: { width: 460, maxWidth: '95vw', maxHeight: '80vh', background: 'var(--c-surface)', color: 'var(--c-text)',
    borderRadius: 12, boxShadow: '0 24px 64px rgba(16,24,40,.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--c-border)' },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--c-text-strong)' },
  close: { width: 30, height: 30, color: 'var(--c-muted)' },
  tabs: { display: 'flex', gap: 6, padding: '10px 16px 0' },
  tab: { border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-muted)',
    borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  tabOn: { background: 'var(--c-primary)', color: 'var(--c-on-primary)', borderColor: 'var(--c-primary)' },
  input: { margin: '10px 16px 0', padding: '9px 12px', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 14 },
  searchRow: { display: 'flex', alignItems: 'center', gap: 8, margin: '10px 16px', padding: '8px 10px',
    border: '1px solid var(--c-border)', borderRadius: 8, color: 'var(--c-faint)' },
  search: { flex: 1, border: 'none', outline: 'none', background: 'none', fontSize: 14, color: 'var(--c-text)' },
  list: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 8px 8px' },
  empty: { padding: 24, textAlign: 'center', color: 'var(--c-faint)', fontSize: 13 },
  contact: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'none',
    cursor: 'pointer', padding: '9px 8px', borderRadius: 8, textAlign: 'left' },
  avatar: { width: 34, height: 34, borderRadius: '50%', background: '#f59e0b', color: '#fff', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cinfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  cname: { fontSize: 14, fontWeight: 600, color: 'var(--c-text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cemail: { fontSize: 12, color: 'var(--c-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  check: { width: 20, height: 20, borderRadius: 6, border: '1.5px solid var(--c-border)', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' },
  checkOn: { background: 'var(--c-primary)', borderColor: 'var(--c-primary)' },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--c-border)' },
  selCount: { fontSize: 13, color: 'var(--c-muted)' },
  create: { padding: '9px 18px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' },
};
