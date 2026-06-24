import apiClient from '../../services/apiClient';

export const notificationsApi = {
  list: (params) => apiClient.get('/notifications', { params }).then((r) => r.data),
  markRead: (id) => apiClient.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => apiClient.patch('/notifications/read-all').then((r) => r.data),
};
