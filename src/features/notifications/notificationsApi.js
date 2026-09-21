import apiClient from '../../services/apiClient';

/**
 * In-app notifications API. Reads pass `_nodedupe` so polling never serves the
 * 60s-cached response (the badge/count must reflect the latest state). Mutations
 * (patch/delete) clear the GET cache automatically in apiClient.
 */
export const notificationsApi = {
  list: ({ filter = 'all', skip = 0, limit = 15 } = {}) =>
    apiClient.get('/notifications', { params: { filter, skip, limit }, _nodedupe: true }).then((r) => r.data),
  unreadCount: () =>
    apiClient.get('/notifications/unread-count', { _nodedupe: true }).then((r) => r.data.unread),
  markRead: (id) => apiClient.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => apiClient.patch('/notifications/read-all').then((r) => r.data),
  remove: (id) => apiClient.delete(`/notifications/${id}`).then((r) => r.data),
  clearAll: () => apiClient.delete('/notifications').then((r) => r.data),
};
