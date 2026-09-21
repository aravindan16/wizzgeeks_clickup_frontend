import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import { useAuth } from '../auth/useAuth';

/**
 * App-wide listener: shows a toast for incoming chat messages when the user is NOT
 * on the chat page (so they don't miss messages while working elsewhere). The chat
 * page itself renders the message live, so we stay quiet there. Rides the shared
 * `wg:ws` window event re-broadcast by the notification socket.
 */
export default function ChatToastListener() {
  const toast = useToast();
  const location = useLocation();
  const { user } = useAuth();
  const me = user?._id || user?.id;

  useEffect(() => {
    const onWs = (e) => {
      const msg = e.detail;
      if (msg?.event !== 'chat.message') return;
      const d = msg.data;
      if (!d || String(d.sender_id) === String(me)) return; // ignore my own messages
      if (location.pathname.startsWith('/chat')) return;     // chat page already shows it
      const who = d.sender_name || 'New message';
      const preview = d.body
        || (d.attachment ? (d.attachment.kind === 'image' ? '📷 Photo' : `📎 ${d.attachment.name || 'File'}`)
          : (d.poll ? '📊 Poll' : 'sent a message'));
      toast.info(`💬 ${who}: ${preview}`);
    };
    window.addEventListener('wg:ws', onWs);
    return () => window.removeEventListener('wg:ws', onWs);
  }, [me, location.pathname, toast]);

  return null;
}
