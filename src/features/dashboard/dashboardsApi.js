import apiClient from '../../services/apiClient';

// User-defined dashboards (ClickUp-style boards), persisted in the backend DB.
export const dashboardsApi = {
  list: () => apiClient.get('/user-dashboards').then((r) => r.data),
  get: (id) => apiClient.get(`/user-dashboards/${id}`).then((r) => r.data),
  create: (payload) => apiClient.post('/user-dashboards', payload).then((r) => r.data),
  update: (id, payload) => apiClient.patch(`/user-dashboards/${id}`, payload).then((r) => r.data),
  remove: (id) => apiClient.delete(`/user-dashboards/${id}`).then((r) => r.data),
  // _silent: searching should not trigger the global page loader.
  searchUsers: (q) => apiClient.get('/user-dashboards/users/search', { params: { q }, _silent: true }).then((r) => r.data),
  members: (id) => apiClient.get(`/user-dashboards/${id}/members`).then((r) => r.data),
  addMember: (id, userId) => apiClient.post(`/user-dashboards/${id}/members`, { user_id: userId }).then((r) => r.data),
  removeMember: (id, userId) => apiClient.delete(`/user-dashboards/${id}/members/${userId}`).then((r) => r.data),
};
