import apiClient from '../../services/apiClient';

export const listsApi = {
  forSpace: (spaceId, params) =>
    apiClient.get('/lists', { params: { space_id: spaceId, ...(params || {}) } }).then((r) => r.data),
  get: (id) => apiClient.get(`/lists/${id}`).then((r) => r.data),
  create: (payload) => apiClient.post('/lists', payload).then((r) => r.data),
  update: (id, payload) => apiClient.patch(`/lists/${id}`, payload).then((r) => r.data),
  duplicate: (id) => apiClient.post(`/lists/${id}/duplicate`).then((r) => r.data),
  archive: (id) => apiClient.post(`/lists/${id}/archive`).then((r) => r.data),
  move: (id, spaceId) => apiClient.post(`/lists/${id}/move`, { space_id: spaceId }).then((r) => r.data),
  remove: (id) => apiClient.delete(`/lists/${id}`).then((r) => r.data),
};
