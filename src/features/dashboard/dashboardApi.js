import apiClient from '../../services/apiClient';

export const dashboardApi = {
  employee: () => apiClient.get('/dashboard/employee').then((r) => r.data),
  team: () => apiClient.get('/dashboard/team').then((r) => r.data),
  manager: () => apiClient.get('/dashboard/manager').then((r) => r.data),
  admin: () => apiClient.get('/dashboard/admin').then((r) => r.data),
};
