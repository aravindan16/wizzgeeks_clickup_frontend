import axios from 'axios';
import { API_BASE_URL } from '../config';

/**
 * Central axios instance.
 * - withCredentials: sends the httpOnly refresh cookie to the backend.
 * - Request interceptor: attaches the in-memory access token.
 * - Response interceptor: on 401, attempts a single silent refresh then retries.
 *
 * The access token is held in memory only (not localStorage) per the security design.
 */
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

// --- Global loading indicator -------------------------------------------------
// Tracks in-flight requests so a top progress bar can show whenever the app is
// talking to the API. Components subscribe via subscribeLoading().
let activeRequests = 0;
const loadingListeners = new Set();
const notifyLoading = () => loadingListeners.forEach((fn) => fn(activeRequests > 0));

export function subscribeLoading(fn) {
  loadingListeners.add(fn);
  fn(activeRequests > 0);
  return () => loadingListeners.delete(fn);
}

const startRequest = () => { activeRequests += 1; notifyLoading(); };
const endRequest = () => { activeRequests = Math.max(0, activeRequests - 1); notifyLoading(); };

// --- Silent scope -------------------------------------------------------------
// While the scope is open, every request fired counts as _silent (no global
// loading overlay). Use for background batches like opening a detail panel:
//   beginSilent(); try { await loadEverything(); } finally { endSilent(); }
let silentScope = 0;
export function beginSilent() { silentScope += 1; }
export function endSilent() { silentScope = Math.max(0, silentScope - 1); }

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  // Requests fired inside a silent scope never show the global loader.
  if (silentScope > 0) config._silent = true;
  if (!config._silent) startRequest();
  return config;
});

let refreshPromise = null;

apiClient.interceptors.response.use(
  (response) => {
    if (!response.config?._silent) endRequest();
    return response;
  },
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    if (!original?._silent) endRequest();

    // A 401 from these endpoints is a credential error (wrong password / bad
    // login), NOT an expired session — so don't refresh + retry (that's what made
    // a single "Change password" click fire change-password → refresh →
    // change-password again). Only genuine expired-token 401s get refreshed.
    const noRetry = ['/auth/refresh', '/auth/login', '/auth/register', '/auth/change-password'];
    if (status === 401 && !original._retry && !noRetry.some((p) => original.url?.includes(p))) {
      original._retry = true;
      try {
        refreshPromise =
          refreshPromise ||
          apiClient.post('/auth/refresh').finally(() => {
            refreshPromise = null;
          });
        const { data } = await refreshPromise;
        if (data?.access_token) {
          setAccessToken(data.access_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return apiClient(original);
        }
      } catch (_) {
        setAccessToken(null);
      }
    }
    return Promise.reject(error);
  },
);

// --- GET de-duplication + short-TTL cache -----------------------------------
// The biggest source of perceived navigation lag is that every page refetches
// on mount, so re-opening a page you just left shows a spinner again. We:
//   1) De-dupe identical concurrent GETs (StrictMode double-mount, rapid nav)
//      so the backend is hit once.
//   2) Cache GET responses briefly (TTL). Re-navigating within the window
//      resolves instantly from memory — no network, no spinner.
// Any write (POST/PUT/PATCH/DELETE) clears the cache, so you never see stale
// data after creating/updating/deleting something. Opt out per-call with
// { _nodedupe: true } (always fresh) — used for polling.
const CACHE_TTL_MS = 60000;
const inflightGets = new Map();
const getCache = new Map(); // key -> { at, response }
const keyOf = (url, config) => `${url}?${JSON.stringify(config.params || {})}`;

const rawGet = apiClient.get.bind(apiClient);
apiClient.get = (url, config = {}) => {
  if (config._nodedupe) return rawGet(url, config);
  const key = keyOf(url, config);

  const cached = getCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return Promise.resolve(cached.response);
  }
  const existing = inflightGets.get(key);
  if (existing) return existing;

  const promise = rawGet(url, config)
    .then((response) => {
      getCache.set(key, { at: Date.now(), response });
      return response;
    })
    .finally(() => inflightGets.delete(key));
  inflightGets.set(key, promise);
  return promise;
};

// Mutations invalidate the read cache so the next GET reflects the change.
const clearGetCache = () => getCache.clear();
['post', 'put', 'patch', 'delete'].forEach((method) => {
  const raw = apiClient[method].bind(apiClient);
  apiClient[method] = (...args) => raw(...args).then((r) => { clearGetCache(); return r; });
});

export default apiClient;
