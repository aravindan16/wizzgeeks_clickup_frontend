import apiClient from '../../services/apiClient';

// User-defined dashboards (ClickUp-style boards), persisted in the backend DB.
export const dashboardsApi = {
  list: () => apiClient.get('/user-dashboards').then((r) => r.data),
  get: (id) => apiClient.get(`/user-dashboards/${id}`).then((r) => r.data),
  create: (payload) => apiClient.post('/user-dashboards', payload).then((r) => r.data),
  update: (id, payload) => apiClient.patch(`/user-dashboards/${id}`, payload).then((r) => r.data),
  remove: (id) => apiClient.delete(`/user-dashboards/${id}`).then((r) => r.data),
};
