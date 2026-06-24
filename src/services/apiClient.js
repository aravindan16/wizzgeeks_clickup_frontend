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

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

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
