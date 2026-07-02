import apiClient from '../../services/apiClient';

// Personal saved filters (Filters page), persisted in the DB (owner-scoped).
export const savedFiltersApi = {
  list: () => apiClient.get('/saved-filters').then((r) => r.data.items || []),
  get: (id) => apiClient.get(`/saved-filters/${id}`).then((r) => r.data),
  create: (payload) => apiClient.post('/saved-filters', payload).then((r) => r.data),
  update: (id, payload) => apiClient.patch(`/saved-filters/${id}`, payload).then((r) => r.data),
  remove: (id) => apiClient.delete(`/saved-filters/${id}`).then((r) => r.data),
};
