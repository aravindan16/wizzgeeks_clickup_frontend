import { useCallback, useEffect, useState } from 'react';
import { IconBell } from '../../components/icons';
import { beginSilent, endSilent } from '../../services/apiClient';
import { connectNotificationSocket } from '../../services/notificationsSocket';
import { notificationsApi } from './notificationsApi';
import NotificationBadge from './NotificationBadge';
import NotificationDrawer from './NotificationDrawer';

/**
 * Topbar notification bell: shows the unread badge and opens the drawer.
 * Realtime via WebSocket — the badge bumps the instant the server pushes a new
 * notification, with no polling. We also reconcile the exact count on mount and
 * whenever the tab regains focus (cheap, event-driven — not periodic).
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const refreshCount = useCallback(async () => {
    beginSilent();
    try { setUnread(await notificationsApi.unreadCount()); }
    catch { /* ignore transient errors */ }
    finally { endSilent(); }
  }, []);

  useEffect(() => {
    refreshCount();
    // Live push: bump the badge immediately and let the drawer (if open) refresh.
    const disconnect = connectNotificationSocket((msg) => {
      if (msg?.event === 'notification.created') {
        setUnread((u) => u + 1);
        window.dispatchEvent(new CustomEvent('wg:notification', { detail: msg.data }));
      }
    });
    // Reconcile the exact count when returning to the tab (covers missed pushes).
    const onVisible = () => { if (!document.hidden) refreshCount(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { disconnect(); document.removeEventListener('visibilitychange', onVisible); };
  }, [refreshCount]);

  return (
    <>
      <button className="icon-btn" style={s.bell} title="Notifications" onClick={() => setOpen(true)}>
        <IconBell size={18} />
        <NotificationBadge count={unread} />
      </button>
      <NotificationDrawer open={open} onClose={() => setOpen(false)} onUnreadChange={setUnread} />
    </>
  );
}

const s = {
  bell: { position: 'relative', width: 36, height: 36 },
};
