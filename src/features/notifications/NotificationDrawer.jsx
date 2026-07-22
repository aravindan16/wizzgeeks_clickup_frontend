import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { IconClose, IconCheck, IconTrash } from '../../components/icons';
import { notificationsApi } from './notificationsApi';
import NotificationFilter from './NotificationFilter';
import NotificationCard from './NotificationCard';
import NotificationEmptyState from './NotificationEmptyState';

const PAGE = 15;

/**
 * Right-side notifications drawer: filter tabs, an infinite-scroll list of cards,
 * and bulk actions (mark all read / clear all). Notifies the bell of unread
 * changes via `onUnreadChange` so the badge stays in sync without a refresh.
 */
export default function NotificationDrawer({ open, onClose, onUnreadChange }) {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const listRef = useRef(null);

  const setUnread = useCallback((u) => onUnreadChange?.(u), [onUnreadChange]);

  const loadPage = useCallback(async (reset, currentLen = 0) => {
    reset ? setLoading(true) : setLoadingMore(true);
    try {
      const data = await notificationsApi.list({ filter, skip: reset ? 0 : currentLen, limit: PAGE });
      setTotal(data.total);
      setUnread(data.unread);
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
    } catch { /* surfaced by apiClient toast */ }
    finally { reset ? setLoading(false) : setLoadingMore(false); }
  }, [filter, setUnread]);

  // (Re)load on open and whenever the filter changes.
  useEffect(() => { if (open) loadPage(true); }, [open, filter, loadPage]);

  // Live-refresh the list when the bell receives a WebSocket push while open.
  useEffect(() => {
    if (!open) return undefined;
    const onPush = () => loadPage(true);
    window.addEventListener('wg:notification', onPush);
    return () => window.removeEventListener('wg:notification', onPush);
  }, [open, loadPage]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onEsc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  const onScroll = (e) => {
    const el = e.currentTarget;
    if (loadingMore || loading || items.length >= total) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) loadPage(false, items.length);
  };

  const markRead = async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    try { await notificationsApi.markRead(id); notificationsApi.unreadCount().then(setUnread); }
    catch { loadPage(true); }
  };
  const markAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    try { await notificationsApi.markAllRead(); if (filter === 'unread') loadPage(true); }
    catch { loadPage(true); }
    toast.success('All notifications marked read');
  };
  const remove = async (id) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    try { await notificationsApi.remove(id); notificationsApi.unreadCount().then(setUnread); }
    catch { loadPage(true); }
  };
  const clearAll = async () => {
    if (!items.length) return;
    if (!(await confirm({ title: 'Clear all notifications', message: 'This removes all your notifications and cannot be undone.', confirmLabel: 'Clear all', danger: true }))) return;
    setItems([]); setTotal(0); setUnread(0);
    try { await notificationsApi.clearAll(); }
    catch { loadPage(true); }
    toast.success('Notifications cleared');
  };
  const openTask = (n) => {
    if (!n.is_read) markRead(n.id);
    onClose();
    navigate(`/tasks/${n.entity_id}`);
  };

  if (!open) return null;

  return createPortal(
    <div style={s.backdrop} onClick={onClose}>
      <aside style={s.panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Notifications">
        <div style={s.head}>
          <span style={s.headTitle}>Notifications</span>
          <div style={s.headActions}>
            <button type="button" style={s.textBtn} onClick={markAll} title="Mark all as read">
              <IconCheck size={14} /> Mark all read
            </button>
            <button type="button" style={s.textBtn} onClick={clearAll} title="Clear all">
              <IconTrash size={14} /> Clear all
            </button>
            <button className="icon-btn" style={s.close} onClick={onClose} title="Close"><IconClose size={16} /></button>
          </div>
        </div>

        <NotificationFilter value={filter} onChange={setFilter} />

        <div style={s.list} ref={listRef} onScroll={onScroll}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={s.skRow}>
                <Skeleton w={34} h={34} r={17} />
                <div style={{ flex: 1 }}>
                  <Skeleton w="70%" h={12} />
                  <Skeleton w="90%" h={10} style={{ marginTop: 8 }} />
                  <Skeleton w={80} h={10} style={{ marginTop: 8 }} />
                </div>
              </div>
            ))
          ) : items.length === 0 ? (
            <NotificationEmptyState filter={filter} />
          ) : (
            <>
              {items.map((n) => (
                <NotificationCard key={n.id} n={n} onOpenTask={openTask} onMarkRead={markRead} onRemove={remove} />
              ))}
              {loadingMore && <div style={s.moreHint}>Loading…</div>}
              {!loadingMore && items.length < total && <div style={s.moreHint}>Scroll for more</div>}
            </>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

const s = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 2000,
    display: 'flex', justifyContent: 'flex-end' },
  panel: { width: 420, maxWidth: '100vw', height: '100%', background: 'var(--c-surface)', color: 'var(--c-text)',
    display: 'flex', flexDirection: 'column', boxShadow: '-16px 0 44px rgba(16,24,40,.28)', animation: 'wg-pop 160ms ease' },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '14px 14px 12px', borderBottom: '1px solid var(--c-border)' },
  headTitle: { fontSize: 16, fontWeight: 700, color: 'var(--c-text-strong)' },
  headActions: { display: 'flex', alignItems: 'center', gap: 4 },
  textBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'none',
    color: 'var(--c-muted)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: '5px 7px', borderRadius: 7 },
  close: { width: 30, height: 30, color: 'var(--c-muted)' },
  list: { flex: 1, minHeight: 0, overflowY: 'auto' },
  skRow: { display: 'flex', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--c-border-2)' },
  moreHint: { textAlign: 'center', padding: '12px', fontSize: 12, color: 'var(--c-faint)' },
};
