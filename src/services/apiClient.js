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

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
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

    // Avoid infinite loops; don't refresh the refresh call itself.
    if (status === 401 && !original._retry && !original.url?.includes('/auth/refresh')) {
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

export default apiClient;
