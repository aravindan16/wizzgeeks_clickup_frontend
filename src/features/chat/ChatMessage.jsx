import { useEffect, useRef, useState } from 'react';
import { Smile, CornerUpLeft, MoreHorizontal, Pencil, Trash2, Pin, Bookmark, Forward, Plus, FileText, Download } from 'lucide-react';
import EmojiPicker from './EmojiPicker';

const fmtSize = (b) => (!b ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);

const initials = (n) => (n || '?').split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '');
const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

/**
 * A single chat message: reply reference, forwarded tag, body (or "deleted"),
 * reactions, and a hover toolbar (react / reply / more → edit·delete·forward·pin·bookmark).
 */
export default function ChatMessage({ m, me, isGroup, showName, seen, actions }) {
  const mine = m.sender_id === me;
  const [menu, setMenu] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [full, setFull] = useState(false);
  const [imgError, setImgError] = useState(false);
  const ref = useRef(null);
  const att = m.attachment;
  const isImageAtt = !!att && (att.kind === 'image' || (att.content_type || '').startsWith('image/'));

  useEffect(() => {
    if (!menu && !emoji && !full) return undefined;
    const h = (e) => { if (!ref.current?.contains(e.target)) { setMenu(false); setEmoji(false); setFull(false); } };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [menu, emoji, full]);

  const react = (e) => { setEmoji(false); setFull(false); actions.onReact(m, e); };
  const reactions = Object.entries(m.reactions || {});

  return (
    <div className="wg-chat-msg" style={{ ...s.row, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      {!mine && (
        <span style={{ ...s.avatar, ...(m.sender_avatar_color ? { background: m.sender_avatar_color } : {}) }}>
          {m.sender_avatar_url ? <img src={m.sender_avatar_url} alt="" style={s.avatarImg} /> : initials(m.sender_name)}
        </span>
      )}

      <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
        <div style={{ position: 'relative' }} ref={ref}>
          {/* Hover toolbar */}
          {!m.is_deleted && (
            <div className="wg-msg-actions" style={{ ...s.actions, ...(mine ? { left: -8, transform: 'translateX(-100%)' } : { right: -8, transform: 'translateX(100%)' }) }}>
              <button style={s.actBtn} title="React" onClick={() => { setEmoji((o) => !o); setMenu(false); setFull(false); }}><Smile size={15} /></button>
              <button style={s.actBtn} title="Reply" onClick={() => actions.onReply(m)}><CornerUpLeft size={15} /></button>
              <button style={s.actBtn} title="More" onClick={() => { setMenu((o) => !o); setEmoji(false); setFull(false); }}><MoreHorizontal size={15} /></button>
              {emoji && !full && (
                <div style={{ ...s.emojiPop, ...(mine ? { right: 0 } : { left: 0 }) }}>
                  {EMOJIS.map((e) => <button key={e} style={s.emojiBtn} onClick={() => react(e)}>{e}</button>)}
                  <button style={s.emojiMore} title="More emojis" onClick={() => setFull(true)}><Plus size={16} /></button>
                </div>
              )}
              {emoji && full && (
                <div style={{ ...s.fullPop, ...(mine ? { right: 0 } : { left: 0 }) }}>
                  <EmojiPicker onPick={react} />
                </div>
              )}
              {menu && (
                <div style={{ ...s.menu, ...(mine ? { right: 0 } : { left: 0 }) }}>
                  {mine && <button style={s.menuItem} onClick={() => { setMenu(false); actions.onEdit(m); }}><Pencil size={14} /> Edit</button>}
                  <button style={s.menuItem} onClick={() => { setMenu(false); actions.onForward(m); }}><Forward size={14} /> Forward</button>
                  <button style={s.menuItem} onClick={() => { setMenu(false); actions.onPin(m); }}><Pin size={14} /> {m.pinned ? 'Unpin' : 'Pin'}</button>
                  <button style={s.menuItem} onClick={() => { setMenu(false); actions.onBookmark(m); }}><Bookmark size={14} /> {m.bookmarked ? 'Remove bookmark' : 'Bookmark'}</button>
                  {mine && <button style={{ ...s.menuItem, color: 'var(--c-danger,#dc2626)' }} onClick={() => { setMenu(false); actions.onDelete(m); }}><Trash2 size={14} /> Delete</button>}
                </div>
              )}
            </div>
          )}

          <div style={{ ...s.bubble, ...(mine ? s.mine : s.other) }}>
            {showName && !mine && <div style={s.sender}>{m.sender_name}</div>}
            {m.forwarded_from && <div style={s.fwd}>↪ Forwarded{m.forwarded_from.sender_name ? ` from ${m.forwarded_from.sender_name}` : ''}</div>}
            {m.reply_to && (
              <div style={{ ...s.reply, borderColor: mine ? 'rgba(255,255,255,.5)' : 'var(--c-border)' }}>
                <span style={s.replyName}>{m.reply_to.sender_name || 'Message'}</span>
                <span style={s.replyBody}>{m.reply_to.body}</span>
              </div>
            )}
            {m.is_deleted ? (
              <span style={s.deleted}>This message was deleted</span>
            ) : (
              <>
                {att?.url && isImageAtt && !imgError && (
                  <a href={att.url} target="_blank" rel="noreferrer" style={s.attachLink}>
                    <img src={att.url} alt={att.name || 'image'} style={s.attachImg} onError={() => setImgError(true)} />
                  </a>
                )}
                {att?.url && (!isImageAtt || imgError) && (
                  <a href={att.url} target="_blank" rel="noreferrer" download={att.name}
                    style={{ ...s.fileCard, ...(mine ? s.fileCardMine : {}) }}>
                    <span style={s.fileIcon}><FileText size={18} /></span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={s.fileName}>{att.name || 'File'}</span>
                      <span style={s.fileMeta}>{isImageAtt ? 'Open image' : fmtSize(att.size)}</span>
                    </span>
                    <Download size={15} style={{ flexShrink: 0, opacity: 0.8 }} />
                  </a>
                )}
                {m.poll && <Poll poll={m.poll} me={me} onVote={(oid) => actions.onVote(m, oid)} mine={mine} />}
                {m.body && <span style={s.body}>{m.body}</span>}
              </>
            )}
            <span style={{ ...s.time, color: mine ? 'rgba(255,255,255,.75)' : 'var(--c-faint)' }}>
              {m.pinned && <Pin size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
              {m.bookmarked && <Bookmark size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
              {m.is_edited && !m.is_deleted && 'edited · '}{clock(m.created_at)}
            </span>
          </div>
        </div>

        {reactions.length > 0 && (
          <div style={s.reactRow}>
            {reactions.map(([e, users]) => {
              const iReacted = users.includes(me);
              return (
                <button key={e} onClick={() => actions.onReact(m, e)}
                  style={{ ...s.reactChip, ...(iReacted ? s.reactChipOn : {}) }}>
                  {e} {users.length}
                </button>
              );
            })}
          </div>
        )}

        {seen && <span style={s.seen}>Seen</span>}
      </div>
    </div>
  );
}

/** Poll rendering + voting (bars, counts, highlight your choices). */
function Poll({ poll, me, onVote, mine }) {
  const total = poll.options.reduce((n, o) => n + (o.votes?.length || 0), 0);
  return (
    <div style={ps.wrap}>
      <div style={{ ...ps.q, color: mine ? 'inherit' : 'var(--c-text-strong)' }}>📊 {poll.question}</div>
      {poll.options.map((o) => {
        const count = o.votes?.length || 0;
        const pct = total ? Math.round((count / total) * 100) : 0;
        const voted = (o.votes || []).includes(me);
        return (
          <button key={o.id} type="button" onClick={() => onVote(o.id)}
            style={{ ...ps.opt, ...(mine ? ps.optMine : {}), ...(voted ? ps.optVoted : {}) }}>
            <span style={{ ...ps.fill, width: `${pct}%`, background: mine ? 'rgba(255,255,255,.25)' : 'var(--c-primary-weak)' }} />
            <span style={ps.optText}>{voted ? '✓ ' : ''}{o.text}</span>
            <span style={ps.optCount}>{count}</span>
          </button>
        );
      })}
      <div style={{ ...ps.total, color: mine ? 'rgba(255,255,255,.8)' : 'var(--c-muted)' }}>
        {total} vote{total === 1 ? '' : 's'}{poll.multi ? ' · multiple choice' : ''}
      </div>
    </div>
  );
}

const ps = {
  wrap: { minWidth: 220, marginBottom: 2 },
  q: { fontSize: 13.5, fontWeight: 700, marginBottom: 6 },
  opt: { position: 'relative', display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
    border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'inherit', borderRadius: 8,
    padding: '7px 10px', marginBottom: 5, cursor: 'pointer', overflow: 'hidden' },
  optMine: { border: '1px solid rgba(255,255,255,.4)', background: 'rgba(255,255,255,.12)' },
  optVoted: { borderColor: 'var(--c-primary)' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 8, zIndex: 0 },
  optText: { position: 'relative', zIndex: 1, flex: 1, fontSize: 13.5 },
  optCount: { position: 'relative', zIndex: 1, fontSize: 12, fontWeight: 700, opacity: 0.9 },
  total: { fontSize: 11.5, marginTop: 2 },
};

const s = {
  row: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: '50%', background: '#f59e0b', color: '#fff', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  bubble: { padding: '8px 12px', borderRadius: 14, fontSize: 14, lineHeight: 1.4 },
  mine: { background: 'var(--c-primary)', color: 'var(--c-on-primary)', borderBottomRightRadius: 4 },
  other: { background: 'var(--c-surface)', color: 'var(--c-text)', border: '1px solid var(--c-border)', borderBottomLeftRadius: 4 },
  sender: { fontSize: 11.5, fontWeight: 700, color: 'var(--c-primary)', marginBottom: 2 },
  fwd: { fontSize: 11, opacity: 0.8, fontStyle: 'italic', marginBottom: 3 },
  reply: { borderLeft: '3px solid', paddingLeft: 8, margin: '2px 0 5px', display: 'flex', flexDirection: 'column', opacity: 0.9 },
  replyName: { fontSize: 11.5, fontWeight: 700 },
  replyBody: { fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 },
  body: { wordBreak: 'break-word', whiteSpace: 'pre-wrap', display: 'block' },
  attachLink: { display: 'block', marginBottom: 4 },
  attachImg: { maxWidth: 260, maxHeight: 260, borderRadius: 10, display: 'block', objectFit: 'cover' },
  fileCard: { display: 'flex', alignItems: 'center', gap: 10, width: 240, padding: '8px 10px', marginBottom: 4,
    borderRadius: 10, border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text)', textDecoration: 'none' },
  fileCardMine: { border: '1px solid rgba(255,255,255,.4)', background: 'rgba(255,255,255,.12)', color: 'inherit' },
  fileIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, background: 'var(--c-surface-3)', color: 'var(--c-muted)', flexShrink: 0 },
  fileName: { display: 'block', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileMeta: { display: 'block', fontSize: 11, opacity: 0.7 },
  deleted: { fontStyle: 'italic', opacity: 0.7 },
  time: { fontSize: 10, marginTop: 3, display: 'block', textAlign: 'right' },
  actions: { position: 'absolute', top: 0, display: 'inline-flex', gap: 2, background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 8, padding: 2, boxShadow: '0 4px 14px rgba(16,24,40,.16)', zIndex: 3 },
  actBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
    border: 'none', background: 'none', color: 'var(--c-muted)', borderRadius: 6, cursor: 'pointer' },
  emojiPop: { position: 'absolute', top: 32, display: 'flex', gap: 2, background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 10, padding: 4, boxShadow: '0 8px 22px rgba(16,24,40,.2)', zIndex: 5 },
  emojiBtn: { border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, padding: 3, borderRadius: 6, lineHeight: 1 },
  emojiMore: { border: 'none', background: 'var(--c-surface-3)', color: 'var(--c-muted)', cursor: 'pointer',
    width: 26, height: 26, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  fullPop: { position: 'absolute', top: 32, zIndex: 6, boxShadow: '0 12px 30px rgba(16,24,40,.22)', borderRadius: 10 },
  menu: { position: 'absolute', top: 32, minWidth: 170, background: 'var(--c-surface)', border: '1px solid var(--c-border)',
    borderRadius: 10, padding: 5, boxShadow: '0 12px 30px rgba(16,24,40,.2)', zIndex: 5 },
  menuItem: { display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', border: 'none',
    background: 'none', cursor: 'pointer', padding: '8px 10px', borderRadius: 7, fontSize: 13.5, color: 'var(--c-text)' },
  reactRow: { display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  reactChip: { border: '1px solid var(--c-border)', background: 'var(--c-surface)', borderRadius: 999,
    padding: '1px 8px', fontSize: 12, cursor: 'pointer', color: 'var(--c-text)' },
  reactChipOn: { background: 'var(--c-primary-weak)', borderColor: 'var(--c-primary)', color: 'var(--c-primary)', fontWeight: 700 },
  seen: { fontSize: 10.5, color: 'var(--c-faint)', marginTop: 3 },
};
