import { getAccessToken } from './apiClient';
import { API_BASE_URL } from '../config';

/**
 * Build the WebSocket URL from API_BASE_URL, correctly for every deployment shape:
 *  - relative base ("/api/v1")            → resolved against the current origin
 *  - absolute base ("https://api.x/api/v1")→ used as-is
 * Always uses wss:// on secure pages (avoids the invalid/mixed-content URLs that the
 * old `API_BASE_URL.replace(/^http/, 'ws')` produced for relative/https bases).
 */
function buildWsUrl(token) {
  const http = new URL(API_BASE_URL, window.location.origin);
  const secure = window.location.protocol === 'https:' || http.protocol === 'https:';
  const proto = secure ? 'wss:' : 'ws:';
  const path = http.pathname.replace(/\/$/, ''); // strip trailing slash
  return `${proto}//${http.host}${path}/notifications/ws?token=${encodeURIComponent(token)}`;
}

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
    let url;
    try {
      url = buildWsUrl(token);
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
