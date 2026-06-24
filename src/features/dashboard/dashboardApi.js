import apiClient from '../../services/apiClient';

export const dashboardApi = {
  employee: () => apiClient.get('/dashboard/employee').then((r) => r.data),
  team: () => apiClient.get('/dashboard/team').then((r) => r.data),
  manager: () => apiClient.get('/dashboard/manager').then((r) => r.data),
  admin: () => apiClient.get('/dashboard/admin').then((r) => r.data),
  tasksByStatus: (params) =>
    apiClient.get('/dashboard/analytics/tasks-by-status', { params }).then((r) => r.data),
  hoursTrend: (params) =>
    apiClient.get('/dashboard/analytics/hours-trend', { params }).then((r) => r.data),
};
