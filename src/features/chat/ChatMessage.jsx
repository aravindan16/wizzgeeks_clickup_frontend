import { useEffect, useRef, useState } from 'react';
import { Smile, CornerUpLeft, MoreHorizontal, Pencil, Trash2, Pin, Bookmark, Forward, Plus, FileText, Download, Check, CheckSquare, Copy } from 'lucide-react';
import EmojiPicker from './EmojiPicker';

const fmtSize = (b) => (!b ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);

const initials = (n) => (n || '?').split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '');
const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];
const popDir = (up) => (up ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' });

/** Render message text, highlighting @mentions — full member names (incl. spaces,
 * matched longest-first) plus a single-word "@name" fallback. */
function renderBody(text, mine, names = []) {
  const escaped = names.filter(Boolean)
    .map((n) => n.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length);
  const alts = [...escaped, '[\\p{L}\\d._-]+'].join('|');
  const re = new RegExp(`(@(?:${alts}))`, 'giu');
  return String(text).split(re).map((p, i) => (p && p[0] === '@'
    ? <span key={i} style={{ ...s.mention, ...(mine ? s.mentionMine : {}) }}>{p}</span>
    : p));
}

/**
 * A single chat message: reply reference, forwarded tag, body (or "deleted"),
 * reactions, and a hover toolbar (react / reply / more → edit·delete·forward·pin·bookmark).
 */
export default function ChatMessage({ m, me, isGroup, showName, seen, actions, selectMode, selected, onMediaLoad, mentionNames, members }) {
  const mine = m.sender_id === me;
  const [menu, setMenu] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [full, setFull] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [reactSheet, setReactSheet] = useState(false);
  const [reactTab, setReactTab] = useState('all'); // 'all' or a specific emoji
  const [openUp, setOpenUp] = useState(true); // open toolbar popups upward vs downward
  const ref = useRef(null);
  const sheetRef = useRef(null);
  // Open upward only when the bubble sits in the lower part of the viewport (else it clips at the top).
  const decideUp = () => {
    const r = ref.current?.getBoundingClientRect();
    return r ? r.top > window.innerHeight * 0.45 : true;
  };
  const att = m.attachment;
  const isImageAtt = !!att && (att.kind === 'image' || (att.content_type || '').startsWith('image/'));
  const hasImage = !!att?.url && isImageAtt && !imgError && !m.is_deleted;
  // Bare image (no caption/poll): hug the image and overlay the time in its corner.
  const imageOnly = hasImage && !m.body && !m.poll;

  useEffect(() => {
    if (!menu && !emoji && !full) return undefined;
    const h = (e) => { if (!ref.current?.contains(e.target)) { setMenu(false); setEmoji(false); setFull(false); } };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [menu, emoji, full]);

  useEffect(() => {
    if (!reactSheet) return undefined;
    const h = (e) => { if (!sheetRef.current?.contains(e.target)) setReactSheet(false); };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [reactSheet]);

  const react = (e) => { setEmoji(false); setFull(false); actions.onReact(m, e); };
  const reactions = Object.entries(m.reactions || {});
  const memberMap = Object.fromEntries((members || []).map((x) => [x.id, x]));
  const reactors = reactions.flatMap(([e, users]) => users.map((uid) => ({ uid, emoji: e })));

  return (
    <div className="wg-chat-msg"
      style={{ ...s.row, justifyContent: mine ? 'flex-end' : 'flex-start',
        ...(selectMode ? { cursor: 'pointer', background: selected ? 'var(--c-primary-weak)' : 'transparent', borderRadius: 10, padding: '3px 6px' } : {}) }}
      onClick={selectMode ? () => actions.onToggleSelect(m) : undefined}>
      {selectMode && (
        <span style={{ ...s.check, ...(selected ? s.checkOn : {}), ...(mine ? { marginRight: 'auto' } : {}) }}>
          {selected && <Check size={13} strokeWidth={3} />}
        </span>
      )}
      {!mine && (
        <span style={{ ...s.avatar, ...(m.sender_avatar_color ? { background: m.sender_avatar_color } : {}) }}>
          {m.sender_avatar_url ? <img src={m.sender_avatar_url} alt="" style={s.avatarImg} /> : initials(m.sender_name)}
        </span>
      )}

      <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
        <div style={{ position: 'relative' }} ref={ref}>
          {/* Hover toolbar */}
          {!m.is_deleted && !selectMode && (
            <div className="wg-msg-actions" style={{ ...s.actions, ...(mine ? { left: -8, transform: 'translateX(-100%)' } : { right: -8, transform: 'translateX(100%)' }) }}>
              <button style={s.actBtn} title="React" onClick={() => { setOpenUp(decideUp()); setEmoji((o) => !o); setMenu(false); setFull(false); }}><Smile size={15} /></button>
              <button style={s.actBtn} title="Reply" onClick={() => actions.onReply(m)}><CornerUpLeft size={15} /></button>
              <button style={s.actBtn} title="More" onClick={() => { setOpenUp(decideUp()); setMenu((o) => !o); setEmoji(false); setFull(false); }}><MoreHorizontal size={15} /></button>
            </div>
          )}
          {/* Popups anchored to the bubble (not the side toolbar) so they float just above the message. */}
          {emoji && !full && (
            <div style={{ ...s.emojiPop, ...popDir(openUp), ...(mine ? { right: 0 } : { left: 0 }) }}>
              {EMOJIS.map((e) => <button key={e} style={s.emojiBtn} onClick={() => react(e)}>{e}</button>)}
              <button style={s.emojiMore} title="More emojis" onClick={() => setFull(true)}><Plus size={16} /></button>
            </div>
          )}
          {emoji && full && (
            <div style={{ ...s.fullPop, ...popDir(openUp), ...(mine ? { right: 0 } : { left: 0 }) }}>
              <EmojiPicker onPick={react} />
            </div>
          )}
          {menu && (
            <div style={{ ...s.menu, ...popDir(openUp), ...(mine ? { right: 0 } : { left: 0 }) }}>
              {m.body && <button style={s.menuItem} onClick={() => { setMenu(false); actions.onCopy(m); }}><Copy size={14} /> Copy</button>}
              {mine && m.body && !m.is_deleted && <button style={s.menuItem} onClick={() => { setMenu(false); actions.onEdit(m); }}><Pencil size={14} /> Edit</button>}
              <button style={s.menuItem} onClick={() => { setMenu(false); actions.onForward(m); }}><Forward size={14} /> Forward</button>
              <button style={s.menuItem} onClick={() => { setMenu(false); actions.onStartSelect(m); }}><CheckSquare size={14} /> Select</button>
              <button style={s.menuItem} onClick={() => { setMenu(false); actions.onPin(m); }}><Pin size={14} /> {m.pinned ? 'Unpin' : 'Pin'}</button>
              <button style={s.menuItem} onClick={() => { setMenu(false); actions.onBookmark(m); }}><Bookmark size={14} /> {m.bookmarked ? 'Remove bookmark' : 'Bookmark'}</button>
              {mine && <button style={{ ...s.menuItem, color: 'var(--c-danger,#dc2626)' }} onClick={() => { setMenu(false); actions.onDelete(m); }}><Trash2 size={14} /> Delete</button>}
            </div>
          )}

          <div style={{ ...s.bubble, ...(mine ? s.mine : s.other), ...(selectMode ? { pointerEvents: 'none' } : {}), ...(hasImage ? s.bubbleMedia : {}) }}>
            {showName && !mine && <div style={s.sender}>{m.sender_name}</div>}
            {m.forwarded_from && <div style={s.fwd}>↪ Forwarded{m.forwarded_from.sender_name ? ` from ${m.forwarded_from.sender_name}` : ''}</div>}
            {m.reply_to && (
              <div style={{ ...s.reply, borderColor: mine ? 'rgba(255,255,255,.5)' : 'var(--c-border)' }}>
                <span style={s.replyName}>{m.reply_to.sender_name || 'Message'}</span>
                <span style={s.replyBody}>{m.reply_to.body}</span>
              </div>
            )}
            {m.is_deleted ? (
              <span style={s.deleted}>
                This message was deleted
                <span style={s.timeSpacer} aria-hidden="true">{clock(m.created_at)}</span>
              </span>
            ) : (
              <>
                {att?.url && isImageAtt && !imgError && (
                  <a href={att.url} target="_blank" rel="noreferrer"
                    style={{ ...s.attachLink, ...(imageOnly ? { marginBottom: 0 } : {}) }}>
                    <img src={att.url} alt={att.name || 'image'} style={s.attachImg}
                      onLoad={() => onMediaLoad?.()} onError={() => { setImgError(true); onMediaLoad?.(); }} />
                    {imageOnly && (
                      <span style={s.imgTime}>
                        {m.pinned && <Pin size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />}
                        {m.bookmarked && <Bookmark size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />}
                        {m.is_edited && 'edited · '}{clock(m.created_at)}
                      </span>
                    )}
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
                {m.body && (
                  <span style={{ ...s.body, ...(hasImage ? s.caption : {}) }}>
                    {renderBody(m.body, mine, mentionNames)}
                    {/* Hidden spacer reserves room on the last line so the corner time never overlaps text. */}
                    <span style={s.timeSpacer} aria-hidden="true">
                      {m.pinned && <Pin size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />}
                      {m.bookmarked && <Bookmark size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />}
                      {m.is_edited && 'edited · '}{clock(m.created_at)}
                    </span>
                  </span>
                )}
              </>
            )}
            {/* Text/caption/deleted messages: time in the bottom-right corner (WhatsApp style). */}
            {(m.body || m.is_deleted) && (
              <span style={{ ...s.timeCorner, color: mine ? 'rgba(255,255,255,.75)' : 'var(--c-faint)' }}>
                {!m.is_deleted && m.pinned && <Pin size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />}
                {!m.is_deleted && m.bookmarked && <Bookmark size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />}
                {!m.is_deleted && m.is_edited && 'edited · '}{clock(m.created_at)}
              </span>
            )}
            {/* Everything else (file-only, poll-only): time on its own row. */}
            {!imageOnly && !m.body && !m.is_deleted && (
              <span style={{ ...s.time, color: mine ? 'rgba(255,255,255,.75)' : 'var(--c-faint)' }}>
                {m.pinned && <Pin size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                {m.bookmarked && <Bookmark size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                {m.is_edited && !m.is_deleted && 'edited · '}{clock(m.created_at)}
              </span>
            )}
          </div>
        </div>

        {reactions.length > 0 && (
          <div style={{ position: 'relative' }} ref={sheetRef}>
            <div style={s.reactRow}>
              {/* One combined pill: the emojis clustered + total reactor count (WhatsApp style). */}
              <button type="button" onClick={() => { setReactTab('all'); setReactSheet((o) => !o); }}
                style={{ ...s.reactChip, ...(reactions.some(([, u]) => u.includes(me)) ? s.reactChipOn : {}) }}>
                {reactions.slice(0, 3).map(([e]) => <span key={e} style={s.reactChipEmoji}>{e}</span>)}
                <span style={s.reactChipCount}>{reactors.length}</span>
              </button>
            </div>
            {reactSheet && (
              <div style={{ ...s.reactSheet, ...(mine ? { right: 0 } : { left: 0 }) }}>
                {/* WhatsApp-style tabs: All + one per emoji, filtering the list below. */}
                <div style={s.reactTabs}>
                  <button type="button" style={{ ...s.reactTab, ...(reactTab === 'all' ? s.reactTabOn : {}) }}
                    onClick={() => setReactTab('all')}>All {reactors.length}</button>
                  {reactions.map(([e, users]) => (
                    <button key={e} type="button" style={{ ...s.reactTab, ...(reactTab === e ? s.reactTabOn : {}) }}
                      onClick={() => setReactTab(e)}>{e} {users.length}</button>
                  ))}
                </div>
                <div style={s.reactSheetList}>
                  {reactors.filter((r) => reactTab === 'all' || r.emoji === reactTab).map(({ uid, emoji: e }) => {
                    const isMe = uid === me;
                    const u = memberMap[uid] || {};
                    const name = isMe ? 'You' : (u.name || m.sender_name || 'Someone');
                    return (
                      <button key={uid + e} type="button" className={isMe ? 'wg-row-hover' : undefined}
                        style={{ ...s.reactor, cursor: isMe ? 'pointer' : 'default', ...(isMe ? {} : { background: 'transparent' }) }}
                        disabled={!isMe} onClick={() => { if (isMe) { actions.onReact(m, e); setReactSheet(false); } }}>
                        <span style={{ ...s.reactorAvatar, ...(u.avatar_color ? { background: u.avatar_color } : {}) }}>
                          {u.avatar_url ? <img src={u.avatar_url} alt="" style={s.avatarImg} /> : initials(name)}
                        </span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span style={s.reactorName}>{name}</span>
                          {isMe && <span style={s.reactorSub}>Tap to remove</span>}
                        </span>
                        <span style={s.reactorEmoji}>{e}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
  bubble: { padding: '8px 12px', borderRadius: 14, fontSize: 14, lineHeight: 1.4, position: 'relative' },
  mine: { background: 'var(--c-primary)', color: 'var(--c-on-primary)', borderBottomRightRadius: 4 },
  other: { background: 'var(--c-surface)', color: 'var(--c-text)', border: '1px solid var(--c-border)', borderBottomLeftRadius: 4 },
  sender: { fontSize: 11.5, fontWeight: 700, color: 'var(--c-primary)', marginBottom: 2 },
  fwd: { fontSize: 11, opacity: 0.8, fontStyle: 'italic', marginBottom: 3 },
  reply: { borderLeft: '3px solid', paddingLeft: 8, margin: '2px 0 5px', display: 'flex', flexDirection: 'column', opacity: 0.9 },
  replyName: { fontSize: 11.5, fontWeight: 700 },
  replyBody: { fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 },
  body: { wordBreak: 'break-word', whiteSpace: 'pre-wrap', display: 'block' },
  attachLink: { display: 'block', marginBottom: 4, position: 'relative' },
  attachImg: { maxWidth: 260, maxHeight: 260, borderRadius: 11, display: 'block', objectFit: 'cover' },
  bubbleMedia: { padding: 3 },
  caption: { display: 'block', padding: '3px 7px 2px' },
  imgTime: { position: 'absolute', right: 7, bottom: 7, fontSize: 10.5, color: '#fff',
    background: 'rgba(0,0,0,.45)', borderRadius: 8, padding: '1px 7px', lineHeight: 1.5, pointerEvents: 'none' },
  fileCard: { display: 'flex', alignItems: 'center', gap: 10, width: 240, padding: '8px 10px', marginBottom: 4,
    borderRadius: 10, border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text)', textDecoration: 'none' },
  fileCardMine: { border: '1px solid rgba(255,255,255,.4)', background: 'rgba(255,255,255,.12)', color: 'inherit' },
  fileIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 8, background: 'var(--c-surface-3)', color: 'var(--c-muted)', flexShrink: 0 },
  fileName: { display: 'block', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileMeta: { display: 'block', fontSize: 11, opacity: 0.7 },
  deleted: { fontStyle: 'italic', opacity: 0.7 },
  time: { fontSize: 10, marginTop: 3, display: 'block', textAlign: 'right' },
  timeCorner: { position: 'absolute', right: 10, bottom: 6, fontSize: 10, lineHeight: 1, whiteSpace: 'nowrap' },
  timeSpacer: { display: 'inline-block', visibility: 'hidden', fontSize: 10, marginLeft: 10, whiteSpace: 'nowrap', userSelect: 'none' },
  actions: { position: 'absolute', top: 0, display: 'inline-flex', gap: 2, background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 8, padding: 2, boxShadow: '0 4px 14px rgba(16,24,40,.16)', zIndex: 3 },
  actBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
    border: 'none', background: 'none', color: 'var(--c-muted)', borderRadius: 6, cursor: 'pointer' },
  emojiPop: { position: 'absolute', display: 'flex', gap: 2, background: 'var(--c-surface)',
    border: '1px solid var(--c-border)', borderRadius: 10, padding: 4, boxShadow: '0 8px 22px rgba(16,24,40,.2)', zIndex: 5 },
  emojiBtn: { border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, padding: 3, borderRadius: 6, lineHeight: 1 },
  emojiMore: { border: 'none', background: 'var(--c-surface-3)', color: 'var(--c-muted)', cursor: 'pointer',
    width: 26, height: 26, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  fullPop: { position: 'absolute', zIndex: 6, boxShadow: '0 12px 30px rgba(16,24,40,.22)', borderRadius: 10 },
  menu: { position: 'absolute', minWidth: 170, background: 'var(--c-surface)', border: '1px solid var(--c-border)',
    borderRadius: 10, padding: 5, boxShadow: '0 12px 30px rgba(16,24,40,.2)', zIndex: 5 },
  menuItem: { display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', border: 'none',
    background: 'none', cursor: 'pointer', padding: '8px 10px', borderRadius: 7, fontSize: 13.5, color: 'var(--c-text)' },
  reactRow: { display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  reactChip: { display: 'inline-flex', alignItems: 'center', gap: 1, border: '1px solid var(--c-border)', background: 'var(--c-surface)', borderRadius: 999,
    padding: '2px 9px', fontSize: 13, cursor: 'pointer', color: 'var(--c-text)' },
  reactChipOn: { background: 'var(--c-primary-weak)', borderColor: 'var(--c-primary)', color: 'var(--c-primary)', fontWeight: 700 },
  reactChipEmoji: { fontSize: 13, lineHeight: 1 },
  reactChipCount: { marginLeft: 4, fontSize: 12, fontWeight: 700 },
  reactSheet: { position: 'absolute', bottom: 'calc(100% + 6px)', minWidth: 240, maxWidth: 300, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, boxShadow: '0 16px 40px rgba(16,24,40,.24)', zIndex: 10, overflow: 'hidden' },
  reactTabs: { display: 'flex', gap: 6, padding: '8px 10px', borderBottom: '1px solid var(--c-border)', overflowX: 'auto' },
  reactTab: { flexShrink: 0, border: 'none', background: 'transparent', cursor: 'pointer', padding: '5px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, color: 'var(--c-muted)' },
  reactTabOn: { background: 'var(--c-primary-weak)', color: 'var(--c-primary)' },
  reactSheetList: { maxHeight: 220, overflowY: 'auto', padding: 6 },
  reactor: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: 'none', padding: '7px 8px', borderRadius: 8 },
  reactorAvatar: { width: 34, height: 34, borderRadius: '50%', background: '#f59e0b', color: '#fff', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, overflow: 'hidden' },
  reactorName: { display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--c-text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  reactorSub: { display: 'block', fontSize: 11.5, color: 'var(--c-muted)' },
  reactorEmoji: { fontSize: 20, flexShrink: 0 },
  seen: { fontSize: 10.5, color: 'var(--c-faint)', marginTop: 3 },
  check: { width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--c-border)', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-on-primary)', alignSelf: 'center' },
  checkOn: { background: 'var(--c-primary)', borderColor: 'var(--c-primary)' },
  mention: { color: 'var(--c-primary)', fontWeight: 700 },
  mentionMine: { color: 'inherit', fontWeight: 700, textDecoration: 'underline' },
};
