import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, Users as UsersIcon, Plus, Bookmark, Pin, X, Smile, Image as ImageIcon, FileText, BarChart3, Send as SendIcon, Forward, MoreVertical, CheckCheck, CheckSquare, Check, User as UserIcon, Star } from 'lucide-react';
import EmojiPicker from './EmojiPicker';
import NewPollModal from './NewPollModal';
import { useHeaderSlot } from '../../layouts/headerSlot';
import { useToast } from '../../components/Toast';
import { useAuth } from '../auth/useAuth';
import { chatApi } from './chatApi';
import ChatMessage from './ChatMessage';
import NewChatModal from './NewChatModal';
import ForwardModal from './ForwardModal';
import AddMembersModal from './AddMembersModal';

const initials = (n) => (n || '?').split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
function timeAgo(iso) {
  if (!iso) return '';
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Avatar({ name, url, color, size = 38 }) {
  return (
    <span style={{ ...s.avatar, width: size, height: size, fontSize: size / 2.8, ...(color ? { background: color } : {}) }}>
      {url ? <img src={url} alt="" style={s.avatarImg} /> : initials(name)}
    </span>
  );
}

/** ClickUp-style chat with full message actions (reply, edit, delete, react, forward, pin, bookmark). */
export default function ChatPage() {
  const slotEl = useHeaderSlot();
  const toast = useToast();
  const { user } = useAuth();
  const me = user?._id || user?.id;

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pinned, setPinned] = useState([]);
  const [showPinned, setShowPinned] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [msgTotal, setMsgTotal] = useState(0); // total messages in the active conversation
  const loadingOlderRef = useRef(false);
  const loadOlderRef = useRef(() => {});
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState(null);
  const [editing, setEditing] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newTab, setNewTab] = useState('direct');
  const [headerMenu, setHeaderMenu] = useState(false);
  const [chatSelectMode, setChatSelectMode] = useState(false);
  const [selectedChats, setSelectedChats] = useState([]); // selected conversation ids
  const [threadMenu, setThreadMenu] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [chatFilter, setChatFilter] = useState('all'); // 'all' | 'favorites'
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [forwarding, setForwarding] = useState(null); // array of messages to forward (null = closed)
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState([]); // selected message ids
  const [savedView, setSavedView] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState([]); // staged attachments [{ id, file, preview, isImage }] before send
  const [attachMenu, setAttachMenu] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const scrollRef = useRef(null);
  const fileRef = useRef(null);       // any-file input
  const imageInputRef = useRef(null); // image-only input
  const emojiRef = useRef(null);
  const attachRef = useRef(null);
  const groupPhotoRef = useRef(null); // group-avatar image input
  const composerInputRef = useRef(null);
  const headerMenuRef = useRef(null);
  const threadMenuRef = useRef(null);
  const msgCacheRef = useRef({}); // conversationId → last-seen messages, for instant re-open
  const isViewingRef = useRef(true); // is this tab actually visible + focused? (gates read receipts)

  const active = conversations.find((c) => c.id === activeId) || null;

  const loadConversations = useCallback(() => chatApi.conversations().then(setConversations).catch(() => {}), []);
  useEffect(() => { loadConversations(); }, [loadConversations]);

  const nearBottomRef = useRef(true); // is the user parked at the newest message?
  const openingRef = useRef(true);    // just opened a chat: force-stick to bottom until images settle
  const openingTimer = useRef(null);
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  const beginOpening = useCallback(() => {
    openingRef.current = true;
    nearBottomRef.current = true;
    if (openingTimer.current) clearTimeout(openingTimer.current);
    openingTimer.current = setTimeout(() => { openingRef.current = false; }, 2500);
  }, []);
  const recomputeNearBottom = () => {
    const el = scrollRef.current;
    if (el) nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  };
  // Prepend the next older page when the user scrolls near the top (WhatsApp-style).
  loadOlderRef.current = async () => {
    if (loadingOlderRef.current || !activeId || messages.length >= msgTotal) return;
    loadingOlderRef.current = true;
    const el = scrollRef.current;
    const prevH = el ? el.scrollHeight : 0;
    try {
      const data = await chatApi.messages(activeId, { skip: messages.length, limit: 30 });
      const older = data.items || [];
      if (data.total != null) setMsgTotal(data.total);
      setMessages((cur) => {
        const seen = new Set(cur.map((m) => m.id));
        return [...older.filter((m) => !seen.has(m.id)), ...cur];
      });
      requestAnimationFrame(() => { // keep the viewport anchored where the user was reading
        const el2 = scrollRef.current;
        if (el2) el2.scrollTop = el2.scrollHeight - prevH;
      });
    } catch { /* */ }
    finally { loadingOlderRef.current = false; }
  };

  // Plain scroll events also fire when images grow the thread — ignore those while opening.
  const onThreadScroll = useCallback(() => {
    if (openingRef.current) return;
    recomputeNearBottom();
    const el = scrollRef.current;
    if (el && el.scrollTop < 80) loadOlderRef.current();
  }, []);
  // A wheel/touch is genuine user intent: end the opening lock and track their position.
  const onUserScroll = useCallback(() => { openingRef.current = false; recomputeNearBottom(); }, []);
  // Media (images) lay out after render and grow the thread — keep pinning to bottom.
  const onMediaLoad = useCallback(() => { if (openingRef.current || nearBottomRef.current) scrollToBottom(); }, [scrollToBottom]);

  useEffect(() => {
    if (!(openingRef.current || nearBottomRef.current)) return undefined;
    scrollToBottom();                                   // jump now…
    const r = requestAnimationFrame(scrollToBottom);    // …and again after layout settles
    return () => cancelAnimationFrame(r);
  }, [messages, activeId, scrollToBottom]);

  // Keep the per-conversation cache in sync with live updates (only when the messages
  // actually belong to the active conversation — avoids caching the wrong one mid-switch).
  useEffect(() => {
    if (activeId && messages.length && messages[0].conversation_id === activeId) {
      msgCacheRef.current[activeId] = messages;
    }
  }, [messages, activeId]);

  const loadPinned = useCallback((id) => chatApi.pinned(id).then(setPinned).catch(() => setPinned([])), []);

  const openConversation = useCallback(async (id) => {
    setSavedView(false); setActiveId(id); setReply(null); setEditing(null); setDraft(''); setShowPinned(false); setMembersOpen(false); setProfileOpen(false); setSelectMode(false); setSelected([]); clearPending();
    beginOpening(); // opening a chat always lands on the newest message (and stays there as images load)
    const cached = msgCacheRef.current[id];
    if (cached) { setMessages(cached); setLoadingMsgs(false); } // show instantly, refresh below
    else { setMessages([]); setLoadingMsgs(true); }
    try {
      const data = await chatApi.messages(id);
      const items = data.items || [];
      msgCacheRef.current[id] = items;
      setMessages(items);
      setMsgTotal(data.total ?? items.length);
      loadPinned(id);
      chatApi.markRead(id).catch(() => {});
      setConversations((cur) => cur.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
    } catch { if (!cached) setMessages([]); }
    finally { setLoadingMsgs(false); }
  }, [loadPinned, beginOpening]);

  // Realtime over the shared WS.
  useEffect(() => {
    const onWs = async (e) => {
      const msg = e.detail;
      if (msg?.event === 'chat.message') {
        const d = msg.data;
        if (d.conversation_id === activeId && isViewingRef.current) {
          // Only mark read when this tab is actually being viewed (not open in the background).
          setMessages((cur) => (cur.some((m) => m.id === d.id) ? cur : [...cur, d]));
          try { await chatApi.markRead(activeId); } catch { /* */ }
          await loadConversations();
          setConversations((cur) => cur.map((c) => (c.id === activeId ? { ...c, unread: 0 } : c)));
        } else if (d.conversation_id === activeId) {
          // Chat open but tab not focused: show the message, keep it unread until they return.
          setMessages((cur) => (cur.some((m) => m.id === d.id) ? cur : [...cur, d]));
          loadConversations();
        } else {
          loadConversations();
        }
      } else if (msg?.event === 'chat.message.updated') {
        const d = msg.data;
        if (d.conversation_id === activeId) {
          setMessages((cur) => cur.map((m) => (m.id === d.id ? { ...m, ...d } : m)));
          loadPinned(activeId);
        }
        loadConversations();
      } else if (msg?.event === 'chat.read') {
        // The other member read the conversation — update their read timestamp so "Seen" shows.
        const d = msg.data;
        setConversations((cur) => cur.map((c) => (c.id === d.conversation_id
          ? { ...c, reads: { ...(c.reads || {}), [d.user_id]: d.at } } : c)));
      }
    };
    window.addEventListener('wg:ws', onWs);
    return () => window.removeEventListener('wg:ws', onWs);
  }, [activeId, loadConversations, loadPinned]);

  // Track whether this tab is actually being viewed; only then do we send read receipts.
  useEffect(() => {
    const setViewing = () => { isViewingRef.current = !document.hidden && document.hasFocus(); };
    // Only on a genuine return-to-tab do we mark read (opening a chat already marks it read).
    const onReturn = () => {
      setViewing();
      if (isViewingRef.current && activeId) {
        chatApi.markRead(activeId).catch(() => {});
        setConversations((cur) => cur.map((c) => (c.id === activeId ? { ...c, unread: 0 } : c)));
      }
    };
    setViewing(); // initialise flag only — no read call on mount / chat switch
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    window.addEventListener('blur', setViewing);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
      window.removeEventListener('blur', setViewing);
    };
  }, [activeId]);

  const mergeUpdated = (u) => {
    setMessages((cur) => cur.map((m) => (m.id === u.id ? { ...m, ...u } : m)));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!activeId) return;
    // Staged attachments → upload + send each (caption rides on the first).
    if (pending.length) {
      const items = pending;
      const caption = draft.trim();
      setUploading(true);
      try {
        for (let i = 0; i < items.length; i++) {
          const att = await chatApi.upload(items[i].file);
          const m = await chatApi.send(activeId, i === 0 ? caption : '', reply?.id, att);
          setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
        }
        clearPending(); setDraft(''); setReply(null); loadConversations();
      } catch { toast.error('Could not send attachments'); }
      finally { setUploading(false); }
      return;
    }
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    try {
      if (editing) {
        const u = await chatApi.edit(editing.id, body);
        mergeUpdated(u); setEditing(null);
      } else {
        const m = await chatApi.send(activeId, body, reply?.id);
        setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
        setReply(null); loadConversations();
      }
    } catch { setDraft(body); }
  };

  // Close the emoji panel on outside click.
  useEffect(() => {
    if (!emojiOpen) return undefined;
    const h = (e) => { if (!emojiRef.current?.contains(e.target)) setEmojiOpen(false); };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [emojiOpen]);

  // Stage the picked file(s) (images or documents) for a preview + caption before send.
  const stageFile = (ev) => {
    const files = Array.from(ev.target.files || []);
    ev.target.value = '';
    setAttachMenu(false);
    if (!files.length) return;
    const staged = files.map((file) => {
      const isImage = (file.type || '').startsWith('image/');
      return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, isImage,
        preview: isImage ? URL.createObjectURL(file) : null };
    });
    setPending((cur) => [...cur, ...staged]);
  };
  const removeStaged = (id) => setPending((cur) => {
    const t = cur.find((p) => p.id === id);
    if (t?.preview) URL.revokeObjectURL(t.preview);
    return cur.filter((p) => p.id !== id);
  });
  const clearPending = () => setPending((cur) => { cur.forEach((p) => p.preview && URL.revokeObjectURL(p.preview)); return []; });

  // Close the attach menu on outside click.
  useEffect(() => {
    if (!attachMenu) return undefined;
    const h = (e) => { if (!attachRef.current?.contains(e.target)) setAttachMenu(false); };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [attachMenu]);

  const changeGroupPhoto = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file || !activeId) return;
    try {
      const conv = await chatApi.setGroupAvatar(activeId, file);
      setConversations((cur) => cur.map((c) => (c.id === conv.id ? { ...c, ...conv } : c)));
      toast.success('Group photo updated');
    } catch { toast.error('Could not update group photo'); }
  };

  // @mention: detect an "@word" token at the caret and offer group members.
  const onDraftChange = (e) => {
    const val = e.target.value;
    setDraft(val);
    if (active?.type !== 'group') { setMentionOpen(false); return; }
    const pos = e.target.selectionStart ?? val.length;
    const match = val.slice(0, pos).match(/(?:^|\s)@([\p{L}\d._-]*)$/u);
    if (match) { setMentionQuery(match[1].toLowerCase()); setMentionOpen(true); }
    else setMentionOpen(false);
  };
  const mentionOptions = (mentionOpen && active?.type === 'group')
    ? active.members.filter((mem) => mem.id !== me && (mem.name || '').toLowerCase().includes(mentionQuery)).slice(0, 6)
    : [];
  const pickMention = (mem) => {
    const el = composerInputRef.current;
    const pos = el?.selectionStart ?? draft.length;
    const handle = (mem.name || '').trim(); // full display name (may contain spaces)
    const before = draft.slice(0, pos).replace(/@([\p{L}\d._-]*)$/u, `@${handle} `);
    const after = draft.slice(pos);
    const next = before + after;
    setDraft(next);
    setMentionOpen(false);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(before.length, before.length); });
  };

  const createPoll = async (question, options, multi) => {
    const p = await chatApi.createPoll(activeId, question, options, multi);
    setMessages((cur) => (cur.some((x) => x.id === p.id) ? cur : [...cur, p]));
    setPollOpen(false); loadConversations();
  };

  const actions = {
    onReply: (m) => { setEditing(null); setReply(m); },
    onEdit: (m) => { setReply(null); setEditing(m); setDraft(m.body || ''); },
    onDelete: async (m) => { try { mergeUpdated(await chatApi.remove(m.id)); } catch { /* toast by client */ } },
    onReact: async (m, emoji) => { try { mergeUpdated(await chatApi.react(m.id, emoji)); } catch { /* */ } },
    onPin: async (m) => { try { mergeUpdated(await chatApi.pin(m.id, !m.pinned)); loadPinned(activeId); } catch { /* */ } },
    onBookmark: async (m) => {
      const wasBookmarked = m.bookmarked;
      try {
        const updated = await chatApi.bookmark(m.id, !wasBookmarked);
        mergeUpdated(updated);
        // Keep the Saved view in sync: drop it when unbookmarked, add/update when bookmarked.
        setBookmarks((cur) => {
          if (!updated.bookmarked) return cur.filter((x) => x.id !== updated.id);
          return cur.some((x) => x.id === updated.id)
            ? cur.map((x) => (x.id === updated.id ? { ...x, ...updated } : x))
            : [updated, ...cur];
        });
        toast.success(wasBookmarked ? 'Removed from saved' : 'Bookmarked');
      } catch { /* */ }
    },
    onForward: (m) => setForwarding([m]),
    onCopy: async (m) => {
      try { await navigator.clipboard.writeText(m.body || ''); toast.success('Copied'); }
      catch { toast.error('Could not copy'); }
    },
    onVote: async (m, optionId) => { try { mergeUpdated(await chatApi.vote(m.id, optionId)); } catch { /* */ } },
    onStartSelect: (m) => { setSelectMode(true); setSelected([m.id]); },
    onToggleSelect: (m) => setSelected((cur) => (cur.includes(m.id) ? cur.filter((x) => x !== m.id) : [...cur, m.id])),
  };

  const exitSelect = () => { setSelectMode(false); setSelected([]); };

  // Forward every staged message to every chosen target (existing chat or a new person).
  const doForward = async (targets) => {
    const msgs = forwarding || []; setForwarding(null);
    try {
      const convIds = [];
      for (const t of targets) {
        if (t.kind === 'user') { // no chat yet → start a direct conversation first
          const conv = await chatApi.createDirect(t.id);
          setConversations((cur) => (cur.some((c) => c.id === conv.id) ? cur : [conv, ...cur]));
          convIds.push(conv.id);
        } else {
          convIds.push(t.id);
        }
      }
      for (const cid of convIds) {
        for (const m of msgs) await chatApi.forward(m.id, cid);
      }
      loadConversations();
      if (convIds.includes(activeId)) openConversation(activeId);
      toast.success(`Forwarded${msgs.length > 1 ? ` ${msgs.length} messages` : ''}`);
      exitSelect();
    } catch { toast.error('Could not forward'); }
  };

  const openSaved = async () => {
    setSavedView(true); setActiveId(null);
    try { setBookmarks(await chatApi.bookmarks()); } catch { setBookmarks([]); }
  };

  const openNew = (tab) => { setNewTab(tab); setNewOpen(true); };

  const markAllRead = async () => {
    const ids = conversations.filter((c) => c.unread > 0).map((c) => c.id);
    if (!ids.length) { toast.success('No unread chats'); return; }
    await Promise.all(ids.map((id) => chatApi.markRead(id).catch(() => {})));
    setConversations((cur) => cur.map((c) => ({ ...c, unread: 0 })));
    toast.success('Marked all as read');
  };

  const exitChatSelect = () => { setChatSelectMode(false); setSelectedChats([]); };
  const toggleChat = (id) => setSelectedChats((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const markSelectedRead = async () => {
    const ids = selectedChats;
    if (!ids.length) return;
    await Promise.all(ids.map((id) => chatApi.markRead(id).catch(() => {})));
    setConversations((cur) => cur.map((c) => (ids.includes(c.id) ? { ...c, unread: 0 } : c)));
    toast.success(`Marked ${ids.length} as read`);
    exitChatSelect();
  };

  // Close the header menu on outside click.
  useEffect(() => {
    if (!headerMenu) return undefined;
    const h = (e) => { if (!headerMenuRef.current?.contains(e.target)) setHeaderMenu(false); };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [headerMenu]);

  // Close the chat-header menu on outside click.
  useEffect(() => {
    if (!threadMenu) return undefined;
    const h = (e) => { if (!threadMenuRef.current?.contains(e.target)) setThreadMenu(false); };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [threadMenu]);

  const markActiveRead = async () => {
    if (!activeId) return;
    await chatApi.markRead(activeId).catch(() => {});
    setConversations((cur) => cur.map((c) => (c.id === activeId ? { ...c, unread: 0 } : c)));
    toast.success('Marked as read');
  };

  const toggleFavorite = async () => {
    if (!activeId) return;
    const wasFav = !!active?.favorite;
    try {
      const conv = await chatApi.setFavorite(activeId, !wasFav);
      setConversations((cur) => cur.map((c) => (c.id === conv.id ? { ...c, ...conv } : c)));
      toast.success(wasFav ? 'Removed from favourites' : 'Added to favourites');
    } catch { toast.error('Could not update favourites'); }
  };

  const onCreated = (conv) => {
    setNewOpen(false);
    setConversations((cur) => (cur.some((c) => c.id === conv.id) ? cur : [conv, ...cur]));
    openConversation(conv.id);
  };

  // DM read receipt: "Seen" under my last message once the other member has read it.
  let seenMsgId = null;
  if (active?.type === 'direct') {
    const otherId = active.members.find((m) => m.id !== me)?.id;
    const otherRead = otherId && active.reads ? active.reads[otherId] : null;
    const mine = messages.filter((m) => m.sender_id === me && !m.is_deleted);
    const last = mine[mine.length - 1];
    if (last && otherRead && new Date(otherRead) >= new Date(last.created_at)) seenMsgId = last.id;
  }

  return (
    <div style={s.page}>
      {slotEl && createPortal(<span style={s.headerTitle}>Chat</span>, slotEl)}
      <div style={s.shell}>
        {/* ── Conversation list ── */}
        <aside style={s.sidebar}>
          <div style={s.sideHead}>
            {chatSelectMode ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button className="icon-btn" style={s.iconBtn} title="Cancel" onClick={exitChatSelect}><X size={16} /></button>
                  <span style={s.sideTitle}>{selectedChats.length} selected</span>
                </div>
                <button className="btn btn-primary" style={s.newBtn} disabled={!selectedChats.length} onClick={markSelectedRead}>
                  <CheckCheck size={15} /> Mark read
                </button>
              </>
            ) : (
            <>
            <span style={s.sideTitle}>Chats</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button className="icon-btn" style={s.iconBtn} title="New chat" onClick={() => openNew('direct')}><Plus size={19} /></button>
              <div style={{ position: 'relative' }} ref={headerMenuRef}>
                <button className="icon-btn" style={s.iconBtn} title="Menu" onClick={() => setHeaderMenu((o) => !o)}><MoreVertical size={18} /></button>
                {headerMenu && (
                  <div style={s.headerMenu}>
                    <button type="button" className="wg-select-opt" style={s.headerMenuItem} onClick={() => { setHeaderMenu(false); openNew('group'); }}><UsersIcon size={16} /> New group</button>
                    <button type="button" className="wg-select-opt" style={s.headerMenuItem} onClick={() => { setHeaderMenu(false); openSaved(); }}><Bookmark size={16} /> Starred messages</button>
                    <button type="button" className="wg-select-opt" style={s.headerMenuItem} onClick={() => { setHeaderMenu(false); setChatSelectMode(true); setSelectedChats([]); }}><CheckSquare size={16} /> Select chats</button>
                    <button type="button" className="wg-select-opt" style={s.headerMenuItem} onClick={() => { setHeaderMenu(false); markAllRead(); }}><CheckCheck size={16} /> Mark all as read</button>
                  </div>
                )}
              </div>
            </div>
            </>
            )}
          </div>
          {!chatSelectMode && (
            <div style={s.filterRow}>
              <button type="button" style={{ ...s.filterTab, ...(chatFilter === 'all' ? s.filterTabOn : {}) }}
                onClick={() => setChatFilter('all')}>All</button>
              <button type="button" style={{ ...s.filterTab, ...(chatFilter === 'favorites' ? s.filterTabOn : {}) }}
                onClick={() => setChatFilter('favorites')}><Star size={13} fill={chatFilter === 'favorites' ? 'currentColor' : 'none'} /> Favourites</button>
            </div>
          )}
          <div style={s.convList}>
            {(() => {
              const shown = chatFilter === 'favorites' ? conversations.filter((c) => c.favorite) : conversations;
              if (shown.length === 0) {
                return <div style={s.sideEmpty}>{chatFilter === 'favorites' ? 'No favourite chats yet.' : <>No conversations yet.<br />Start one with “New”.</>}</div>;
              }
              return shown.map((c) => (
              <button key={c.id} className="wg-row-hover"
                style={{ ...s.convRow,
                  ...(chatSelectMode && selectedChats.includes(c.id) ? { background: 'var(--c-primary-weak)' }
                    : (c.id === activeId && !savedView && !chatSelectMode ? s.convRowActive : {})) }}
                onClick={() => (chatSelectMode ? toggleChat(c.id) : openConversation(c.id))}>
                {chatSelectMode && (
                  <span style={{ ...s.chatCheck, ...(selectedChats.includes(c.id) ? s.chatCheckOn : {}) }}>
                    {selectedChats.includes(c.id) && <Check size={13} strokeWidth={3} />}
                  </span>
                )}
                {c.type === 'group'
                  ? (c.avatar_url
                    ? <span style={{ ...s.avatar, width: 38, height: 38 }}><img src={c.avatar_url} alt="" style={s.avatarImg} /></span>
                    : <span style={{ ...s.avatar, width: 38, height: 38, background: 'var(--c-primary-weak)', color: 'var(--c-primary)' }}><UsersIcon size={17} /></span>)
                  : <Avatar name={c.name} url={c.avatar_url} color={c.avatar_color} />}
                <span style={s.convBody}>
                  <span style={s.convTop}>
                    <span style={s.convName}>{c.name}</span>
                    <span style={s.convTime}>{timeAgo(c.last_message?.created_at)}</span>
                  </span>
                  <span style={s.convPreview}>
                    {c.last_message ? `${c.last_message.sender_id === me ? 'You: ' : ''}${c.last_message.body || 'message deleted'}`
                      : (c.type === 'group' ? 'Group created' : 'Say hello 👋')}
                  </span>
                </span>
                {c.favorite && <Star size={13} fill="currentColor" style={{ color: 'var(--c-primary)', flexShrink: 0 }} />}
                {c.unread > 0 && <span style={s.unread}>{c.unread > 9 ? '9+' : c.unread}</span>}
              </button>
              ));
            })()}
          </div>
        </aside>

        {/* ── Right pane ── */}
        <section style={s.thread}>
          {savedView ? (
            <>
              <div style={s.threadHead}><Bookmark size={18} /><div style={s.threadName}>Saved messages</div></div>
              <div style={s.messages}>
                {bookmarks.length === 0 ? <div style={s.msgHint}>No saved messages yet.</div>
                  : bookmarks.map((m) => <ChatMessage key={m.id} m={m} me={me} isGroup={false} actions={actions} />)}
              </div>
            </>
          ) : !active ? (
            <div style={s.threadEmpty}>
              <span style={s.emptyIcon}><MessageSquare size={30} strokeWidth={1.8} /></span>
              <div style={s.emptyTitle}>Select a conversation</div>
              <div style={s.emptySub}>Or start a new direct or group chat.</div>
            </div>
          ) : (
            <>
              <div style={s.threadHead}>
                {active.type === 'group'
                  ? (
                    <button type="button" style={s.groupAvatarBtn} title="Change group photo"
                      onClick={() => groupPhotoRef.current?.click()}>
                      {active.avatar_url
                        ? <span style={{ ...s.avatar, width: 34, height: 34 }}><img src={active.avatar_url} alt="" style={s.avatarImg} /></span>
                        : <span style={{ ...s.avatar, width: 34, height: 34, background: 'var(--c-primary-weak)', color: 'var(--c-primary)' }}><UsersIcon size={16} /></span>}
                      <span style={s.groupAvatarEdit}><ImageIcon size={10} /></span>
                    </button>
                  )
                  : <Avatar name={active.name} url={active.avatar_url} color={active.avatar_color} size={34} />}
                {active.type === 'group' ? (
                  <button type="button" style={s.headInfoBtn}
                    onClick={() => setProfileOpen(true)} title="Group info">
                    <div style={s.threadName}>{active.name}</div>
                    <div style={s.threadSub}>
                      {active.members.map((mem) => (mem.id === me ? 'You' : (mem.name || 'Unknown'))).join(', ')}
                    </div>
                  </button>
                ) : (
                  <button type="button" style={s.headInfoBtn}
                    onClick={() => setProfileOpen(true)} title="Contact info">
                    <div style={s.threadName}>{active.name}</div>
                    <div style={s.threadSub}>Direct message</div>
                  </button>
                )}
                {pinned.length > 0 && (
                  <button className="icon-btn" style={s.iconBtn} title="Pinned messages" onClick={() => setShowPinned((o) => !o)}>
                    <Pin size={16} /> <span style={{ fontSize: 12, marginLeft: 3 }}>{pinned.length}</span>
                  </button>
                )}
                <div style={{ position: 'relative' }} ref={threadMenuRef}>
                  <button className="icon-btn" style={s.iconBtn} title="Options" onClick={() => setThreadMenu((o) => !o)}><MoreVertical size={18} /></button>
                  {threadMenu && (
                    <div style={s.headerMenu}>
                      <button type="button" className="wg-select-opt" style={s.headerMenuItem}
                        onClick={() => { setThreadMenu(false); setProfileOpen(true); }}>
                        <UserIcon size={16} /> {active.type === 'group' ? 'View group info' : 'View profile'}
                      </button>
                      <button type="button" className="wg-select-opt" style={s.headerMenuItem}
                        onClick={() => { setThreadMenu(false); toggleFavorite(); }}>
                        <Star size={16} fill={active.favorite ? 'currentColor' : 'none'} /> {active.favorite ? 'Remove from favourites' : 'Add to favourites'}
                      </button>
                      <button type="button" className="wg-select-opt" style={s.headerMenuItem}
                        onClick={() => { setThreadMenu(false); openSaved(); }}><Bookmark size={16} /> Starred messages</button>
                      <button type="button" className="wg-select-opt" style={s.headerMenuItem}
                        onClick={() => { setThreadMenu(false); markActiveRead(); }}><CheckCheck size={16} /> Mark as read</button>
                    </div>
                  )}
                </div>
              </div>

              <input ref={groupPhotoRef} type="file" accept="image/*" hidden onChange={changeGroupPhoto} />

              {showPinned && pinned.length > 0 && (
                <div style={s.pinBar}>
                  <div style={s.pinTitle}>📌 Pinned</div>
                  {pinned.map((p) => (
                    <div key={p.id} style={s.pinItem}>
                      <span style={s.pinName}>{p.sender_name}:</span> <span style={s.pinBody}>{p.body}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectMode && (
                <div style={s.selectBar}>
                  <button className="icon-btn" style={s.iconBtn} title="Cancel" onClick={exitSelect}><X size={16} /></button>
                  <span style={s.selectCount}>{selected.length} selected</span>
                  <button className="btn btn-primary" style={s.selectFwd} disabled={!selected.length}
                    onClick={() => setForwarding(messages.filter((m) => selected.includes(m.id) && !m.is_deleted))}>
                    <Forward size={15} /> Forward
                  </button>
                </div>
              )}

              <div style={s.messages} ref={scrollRef} onScroll={onThreadScroll} onWheel={onUserScroll} onTouchMove={onUserScroll}>
                {loadingMsgs ? <div style={s.msgHint}>Loading…</div>
                  : messages.length === 0 ? <div style={s.msgHint}>No messages yet — say hello 👋</div>
                    : messages.map((m, i) => (
                      <ChatMessage key={m.id} m={m} me={me} isGroup={active.type === 'group'}
                        showName={active.type === 'group' && (i === 0 || messages[i - 1].sender_id !== m.sender_id)}
                        seen={m.id === seenMsgId} actions={actions} onMediaLoad={onMediaLoad}
                        mentionNames={active.members.map((mem) => mem.name)} members={active.members}
                        selectMode={selectMode} selected={selected.includes(m.id)} />
                    ))}
              </div>

              {(reply || editing) && (
                <div style={s.banner}>
                  <div style={{ minWidth: 0 }}>
                    <div style={s.bannerTitle}>{editing ? 'Editing message' : `Replying to ${reply.sender_name || ''}`}</div>
                    <div style={s.bannerBody}>{editing ? editing.body : reply.body}</div>
                  </div>
                  <button className="icon-btn" style={s.iconBtn} onClick={() => { setReply(null); setEditing(null); setDraft(''); }}><X size={15} /></button>
                </div>
              )}

              {pending.length > 0 && (
                <div style={s.previewStrip}>
                  {pending.map((p) => (
                    <div key={p.id} style={s.previewItem} title={p.file.name}>
                      {p.isImage
                        ? <img src={p.preview} alt="" style={s.previewThumb} />
                        : <span style={s.previewFile}><FileText size={20} /><span style={s.previewFileName}>{p.file.name}</span></span>}
                      <button type="button" style={s.previewRemove} title="Remove" onClick={() => removeStaged(p.id)}><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
              {!selectMode && (
              <form style={s.composer} onSubmit={submit}>
                <div style={{ position: 'relative' }} ref={emojiRef}>
                  <button type="button" className="icon-btn" style={s.composerIcon} title="Emoji"
                    onClick={() => setEmojiOpen((o) => !o)}><Smile size={20} /></button>
                  {emojiOpen && (
                    <div style={s.emojiPanel}>
                      <EmojiPicker onPick={(native) => setDraft((d) => d + native)} />
                    </div>
                  )}
                </div>
                <div style={{ position: 'relative' }} ref={attachRef}>
                  <button type="button" className="icon-btn" style={s.composerIcon} title="Attach"
                    onClick={() => setAttachMenu((o) => !o)} disabled={!!editing || uploading}><Plus size={20} /></button>
                  {attachMenu && (
                    <div style={s.attachMenu}>
                      <button type="button" className="wg-select-opt" style={s.attachItem} onClick={() => { setAttachMenu(false); imageInputRef.current?.click(); }}><ImageIcon size={16} /> Image</button>
                      <button type="button" className="wg-select-opt" style={s.attachItem} onClick={() => { setAttachMenu(false); fileRef.current?.click(); }}><FileText size={16} /> File</button>
                      <button type="button" className="wg-select-opt" style={s.attachItem} onClick={() => { setAttachMenu(false); setPollOpen(true); }}><BarChart3 size={16} /> Poll</button>
                    </div>
                  )}
                </div>
                <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={stageFile} />
                <input ref={fileRef} type="file" multiple hidden onChange={stageFile} />
                <div style={s.inputWrap}>
                  {mentionOptions.length > 0 && (
                    <div style={s.mentionPanel}>
                      <div style={s.mentionHead}>Members</div>
                      {mentionOptions.map((mem) => (
                        <button key={mem.id} type="button" className="wg-select-opt" style={s.mentionItem}
                          onMouseDown={(e) => { e.preventDefault(); pickMention(mem); }}>
                          <Avatar name={mem.name} url={mem.avatar_url} color={mem.avatar_color} size={26} />
                          <span style={s.mentionName}>{mem.name || 'Unknown'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <input ref={composerInputRef} style={s.composerInput}
                    placeholder={pending.length ? 'Add a caption…' : uploading ? 'Uploading…' : (editing ? 'Edit message…' : 'Type a message…')}
                    value={draft} onChange={onDraftChange} onBlur={() => setMentionOpen(false)} autoFocus />
                  {(draft.trim() || pending.length > 0) && (
                    <button type="submit" style={s.sendInside} disabled={uploading} title={editing ? 'Save' : 'Send'}>
                      <SendIcon size={17} />
                    </button>
                  )}
                </div>
              </form>
              )}
            </>
          )}

          {profileOpen && active && (() => {
            const isGroup = active.type === 'group';
            const other = isGroup ? {} : (active.members.find((mm) => mm.id !== me) || {});
            return (
              <div style={s.drawerBackdrop} onClick={() => setProfileOpen(false)}>
                <aside className="wg-drawer-anim" style={s.drawer} onClick={(e) => e.stopPropagation()}>
                  <div style={s.drawerHead}>
                    <span style={s.drawerTitle}>{isGroup ? 'Group info' : 'Contact info'}</span>
                    <button className="icon-btn" style={s.iconBtn} title="Close" onClick={() => setProfileOpen(false)}><X size={16} /></button>
                  </div>
                  <div style={s.drawerBody}>
                    {isGroup ? (
                      <button type="button" style={s.groupAvatarBtn} title="Change group photo" onClick={() => groupPhotoRef.current?.click()}>
                        {active.avatar_url
                          ? <span style={{ ...s.avatar, width: 96, height: 96 }}><img src={active.avatar_url} alt="" style={s.avatarImg} /></span>
                          : <span style={{ ...s.avatar, width: 96, height: 96, background: 'var(--c-primary-weak)', color: 'var(--c-primary)' }}><UsersIcon size={40} /></span>}
                        <span style={s.groupAvatarEdit}><ImageIcon size={11} /></span>
                      </button>
                    ) : (
                      <Avatar name={other.name || active.name} url={other.avatar_url || active.avatar_url} color={other.avatar_color || active.avatar_color} size={96} />
                    )}
                    <div style={s.profileName}>{isGroup ? active.name : (other.name || active.name)}</div>
                    <div style={s.profileSub}>{isGroup ? `${active.members.length} members` : 'Direct message'}</div>

                    {isGroup ? (
                      <>
                        <div style={s.memberActions}>
                          <button type="button" className="btn" style={s.memberActionBtn} onClick={() => groupPhotoRef.current?.click()}>
                            <ImageIcon size={14} /> {active.avatar_url ? 'Change photo' : 'Add photo'}
                          </button>
                          <button type="button" className="btn" style={s.memberActionBtn} onClick={() => setAddMembersOpen(true)}>
                            <Plus size={14} /> Add members
                          </button>
                        </div>
                        <div style={s.drawerMemberList}>
                          <div style={s.memberBarTitle}>Members · {active.members.length}</div>
                          {active.members.map((mem) => (
                            <div key={mem.id} style={s.memberRow}>
                              <Avatar name={mem.name} url={mem.avatar_url} color={mem.avatar_color} size={34} />
                              <span style={s.memberName}>{mem.name || 'Unknown'}{mem.id === me ? ' (You)' : ''}</span>
                              {mem.id === active.created_by && <span style={s.memberTag}>Creator</span>}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <button className="btn btn-primary" style={s.profileBtn} onClick={() => setProfileOpen(false)}><MessageSquare size={15} /> Message</button>
                    )}
                  </div>
                </aside>
              </div>
            );
          })()}
        </section>
      </div>

      <NewChatModal open={newOpen} initialTab={newTab} onClose={() => setNewOpen(false)} onCreated={onCreated} />
      <ForwardModal open={!!forwarding} conversations={conversations} messages={forwarding}
        onSubmit={doForward} onClose={() => setForwarding(null)} />
      <NewPollModal open={pollOpen} onClose={() => setPollOpen(false)} onCreate={createPoll} />
      <AddMembersModal open={addMembersOpen} convId={activeId}
        existingIds={active?.members?.map((mm) => mm.id) || []}
        onClose={() => setAddMembersOpen(false)}
        onAdded={(conv) => {
          setAddMembersOpen(false);
          setConversations((cur) => cur.map((c) => (c.id === conv.id ? { ...c, ...conv } : c)));
          toast.success('Members added');
        }} />

    </div>
  );
}

const s = {
  page: { display: 'flex', flexDirection: 'column', height: 'calc(100% + 24px)', minHeight: 0, marginBottom: -24 },
  headerTitle: { fontSize: 16, fontWeight: 700, color: 'var(--c-text-strong)' },
  shell: { flex: 1, minHeight: 0, display: 'flex', border: '1px solid var(--c-border)', borderRadius: 12, overflow: 'hidden', background: 'var(--c-surface)' },
  sidebar: { width: 320, flexShrink: 0, borderRight: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', minHeight: 0 },
  sideHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 12px 10px', borderBottom: '1px solid var(--c-border)' },
  sideTitle: { fontSize: 15, fontWeight: 700, color: 'var(--c-text-strong)' },
  iconBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32, height: 32, color: 'var(--c-muted)' },
  newBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  headerMenu: { position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 200, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, padding: 6, boxShadow: '0 12px 30px rgba(16,24,40,.2)', zIndex: 30 },
  headerMenuItem: { display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', padding: '9px 11px', borderRadius: 7, fontSize: 13.5, color: 'var(--c-text)' },
  filterRow: { display: 'flex', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--c-border)' },
  filterTab: { display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--c-border)', background: 'transparent', color: 'var(--c-muted)', cursor: 'pointer', padding: '5px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600 },
  filterTabOn: { background: 'var(--c-primary-weak)', color: 'var(--c-primary)', borderColor: 'var(--c-primary)' },
  chatCheck: { width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--c-border)', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-on-primary)' },
  chatCheckOn: { background: 'var(--c-primary)', borderColor: 'var(--c-primary)' },
  drawerBackdrop: { position: 'absolute', inset: 0, background: 'rgba(15,23,42,.4)', zIndex: 40 },
  drawer: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 320, maxWidth: '90%', background: 'var(--c-surface)', color: 'var(--c-text)', boxShadow: '-8px 0 32px rgba(16,24,40,.22)', display: 'flex', flexDirection: 'column', zIndex: 41 },
  drawerHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--c-border)' },
  drawerTitle: { fontSize: 15, fontWeight: 700, color: 'var(--c-text-strong)' },
  drawerBody: { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '32px 20px' },
  profileName: { fontSize: 19, fontWeight: 700, color: 'var(--c-text-strong)', marginTop: 12, textAlign: 'center' },
  profileSub: { fontSize: 13, color: 'var(--c-muted)' },
  profileBtn: { display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 18, padding: '9px 18px', fontSize: 13.5 },
  convList: { flex: 1, minHeight: 0, overflowY: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 4 },
  sideEmpty: { padding: '32px 20px', textAlign: 'center', color: 'var(--c-faint)', fontSize: 13, lineHeight: 1.6 },
  convRow: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', cursor: 'pointer', padding: '9px 10px', borderRadius: 10, textAlign: 'left' },
  convRowActive: { background: 'var(--c-primary-weak)' },
  convBody: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  convTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  convName: { fontSize: 14, fontWeight: 600, color: 'var(--c-text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  convTime: { fontSize: 11, color: 'var(--c-faint)', flexShrink: 0 },
  convPreview: { fontSize: 12.5, color: 'var(--c-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  unread: { minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--c-primary)', color: 'var(--c-on-primary)', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  thread: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' },
  threadEmpty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--c-muted)' },
  emptyIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 60, height: 60, borderRadius: '50%', background: 'var(--c-surface-3)', color: 'var(--c-faint)', marginBottom: 6 },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: 'var(--c-text-strong)' },
  emptySub: { fontSize: 13 },
  threadHead: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--c-border)' },
  threadName: { fontSize: 15, fontWeight: 700, color: 'var(--c-text-strong)' },
  threadSub: { fontSize: 12, color: 'var(--c-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  headInfoBtn: { minWidth: 0, flex: 1, textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 0', outline: 'none', transform: 'none' },
  groupAvatarBtn: { position: 'relative', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', flexShrink: 0, lineHeight: 0 },
  groupAvatarEdit: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: 'var(--c-primary)', color: 'var(--c-on-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--c-surface)' },
  memberActions: { display: 'flex', gap: 8, marginTop: 16 },
  memberActionBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '7px 11px' },
  drawerMemberList: { width: '100%', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 2 },
  memberBar: { borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface-2)', maxHeight: 260, overflowY: 'auto' },
  memberBarHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', position: 'sticky', top: 0, background: 'var(--c-surface-2)' },
  memberBarTitle: { fontSize: 12.5, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: .4 },
  memberList: { padding: '0 8px 8px' },
  memberRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 8 },
  memberName: { flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--c-text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  memberTag: { fontSize: 11, fontWeight: 700, color: 'var(--c-primary)', background: 'var(--c-primary-weak)', padding: '2px 8px', borderRadius: 999 },
  selectBar: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface-2)' },
  selectCount: { flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--c-text-strong)' },
  selectFwd: { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, padding: '7px 14px' },
  pinBar: { padding: '8px 16px', borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface-2)', maxHeight: 120, overflowY: 'auto' },
  pinTitle: { fontSize: 11, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', marginBottom: 4 },
  pinItem: { fontSize: 12.5, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '1px 0' },
  pinName: { fontWeight: 700 },
  pinBody: { color: 'var(--c-muted)' },
  messages: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--c-surface-2)' },
  msgHint: { textAlign: 'center', color: 'var(--c-faint)', fontSize: 13, padding: 20 },
  banner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 14px', borderTop: '1px solid var(--c-border)', background: 'var(--c-surface-2)' },
  bannerTitle: { fontSize: 12, fontWeight: 700, color: 'var(--c-primary)' },
  bannerBody: { fontSize: 12.5, color: 'var(--c-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 460 },
  previewStrip: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--c-border)', background: 'var(--c-surface-2)', overflowX: 'auto' },
  previewItem: { position: 'relative', flexShrink: 0 },
  previewThumb: { width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--c-border)', display: 'block' },
  previewFile: { width: 120, height: 64, borderRadius: 8, border: '1px solid var(--c-border)', background: 'var(--c-surface-3)', color: 'var(--c-muted)', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px' },
  previewFileName: { fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  previewRemove: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(16,24,40,.18)' },
  attachMenu: { position: 'absolute', bottom: 46, left: 0, minWidth: 150, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, padding: 5, boxShadow: '0 12px 30px rgba(16,24,40,.2)', zIndex: 20 },
  attachItem: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', padding: '9px 10px', borderRadius: 7, fontSize: 13.5, color: 'var(--c-text)' },
  composer: { display: 'flex', alignItems: 'center', gap: 6, padding: 12, borderTop: '1px solid var(--c-border)', background: 'var(--c-surface)' },
  composerIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, color: 'var(--c-muted)' },
  emojiPanel: { position: 'absolute', bottom: 46, left: 0, zIndex: 20, boxShadow: '0 12px 30px rgba(16,24,40,.2)', borderRadius: 10 },
  inputWrap: { position: 'relative', flex: 1, display: 'flex' },
  mentionPanel: { position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, right: 0, maxHeight: 220, overflowY: 'auto', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, padding: 5, boxShadow: '0 12px 30px rgba(16,24,40,.2)', zIndex: 25 },
  mentionHead: { fontSize: 11, fontWeight: 700, color: 'var(--c-muted)', textTransform: 'uppercase', letterSpacing: .4, padding: '4px 8px 6px' },
  mentionItem: { display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', padding: '7px 8px', borderRadius: 7, color: 'var(--c-text)' },
  mentionName: { fontSize: 13.5, color: 'var(--c-text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  composerInput: { width: '100%', boxSizing: 'border-box', padding: '10px 46px 10px 14px', border: '1px solid var(--c-border)', borderRadius: 999, fontSize: 14, background: 'var(--c-surface)', color: 'var(--c-text)' },
  sendInside: { position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none', borderRadius: '50%', cursor: 'pointer' },
  avatar: { borderRadius: '50%', background: '#f59e0b', color: '#fff', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
};
