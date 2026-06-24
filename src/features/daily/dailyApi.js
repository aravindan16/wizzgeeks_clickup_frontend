import apiClient from '../../services/apiClient';

export const dailyApi = {
  create: (payload) => apiClient.post('/daily-updates', payload).then((r) => r.data),
  update: (id, payload) => apiClient.patch(`/daily-updates/${id}`, payload).then((r) => r.data),
  get: (id) => apiClient.get(`/daily-updates/${id}`).then((r) => r.data),
  mine: (params) => apiClient.get('/daily-updates/me', { params }).then((r) => r.data),
  summary: (params) => apiClient.get('/daily-updates/summary', { params }).then((r) => r.data),
  team: (params) => apiClient.get('/daily-updates/team', { params }).then((r) => r.data),
  missing: (params) => apiClient.get('/daily-updates/missing', { params }).then((r) => r.data),
  blockers: (params) => apiClient.get('/daily-updates/blockers', { params }).then((r) => r.data),
};

export const ENTRY_STATUS = ['planned', 'in_progress', 'completed', 'blocked', 'on_hold'];

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
