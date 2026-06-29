import apiClient from '../../services/apiClient';

export const dailyApi = {
  team: (params) => apiClient.get('/daily-updates/team', { params }).then((r) => r.data),
  missing: (params) => apiClient.get('/daily-updates/missing', { params }).then((r) => r.data),
  blockers: (params) => apiClient.get('/daily-updates/blockers', { params }).then((r) => r.data),
};

export const ENTRY_STATUS = ['planned', 'in_progress', 'completed', 'blocked', 'on_hold'];

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
