import { getAccessToken } from './apiClient';
import { API_BASE_URL } from '../config';

/**
 * Realtime notification socket. Connects to the backend WS endpoint (auth via
 * the access token as a query param, since WS carries no auth header), invokes
 * `onMessage(payload)` for each pushed message, and transparently reconnects
 * with capped exponential backoff. Returns a disconnect function.
 */
export function connectNotificationSocket(onMessage) {
  let ws = null;
  let stopped = false;
  let retry = 0;
  let timer = null;

  const scheduleReconnect = () => {
    if (stopped) return;
    const delay = Math.min(30000, 1000 * 2 ** Math.min(retry, 5));
    retry += 1;
    timer = setTimeout(open, delay);
  };

  function open() {
    if (stopped) return;
    const token = getAccessToken();
    if (!token) { timer = setTimeout(open, 1500); return; } // wait until authenticated
    const url = `${API_BASE_URL.replace(/^http/, 'ws')}/notifications/ws?token=${encodeURIComponent(token)}`;
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }
    ws.onopen = () => { retry = 0; };
    ws.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)); } catch { /* ignore malformed frames */ }
    };
    ws.onclose = () => { ws = null; scheduleReconnect(); };
    ws.onerror = () => { try { ws && ws.close(); } catch { /* ignore */ } };
  }

  open();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (ws) { try { ws.close(); } catch { /* ignore */ } }
  };
}
