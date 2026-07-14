import apiClient from '../../services/apiClient';

// Personal saved filters (Filters page), persisted in the DB (owner-scoped).
export const savedFiltersApi = {
  list: () => apiClient.get('/saved-filters').then((r) => r.data.items || []),
  get: (id) => apiClient.get(`/saved-filters/${id}`).then((r) => r.data),
  // One call: the saved filter's definition + its evaluated results + the reference
  // data (spaces / lists / assignee users) needed to render the results table.
  results: (id) => apiClient.get(`/saved-filters/${id}/results`, { _silent: true }).then((r) => r.data),
  // Evaluate an ad-hoc rule tree server-side (live builder preview / edited filter).
  evaluate: (cards, conj) => apiClient.post('/saved-filters/evaluate', { cards, conj }, { _silent: true }).then((r) => r.data),
  create: (payload) => apiClient.post('/saved-filters', payload).then((r) => r.data),
  update: (id, payload) => apiClient.patch(`/saved-filters/${id}`, payload).then((r) => r.data),
  remove: (id) => apiClient.delete(`/saved-filters/${id}`).then((r) => r.data),
  // sharing (owner-managed members)
  searchUsers: (q) => apiClient.get('/saved-filters/users/search', { params: { q }, _silent: true }).then((r) => r.data),
  members: (id) => apiClient.get(`/saved-filters/${id}/members`).then((r) => r.data),
  addMember: (id, userId) => apiClient.post(`/saved-filters/${id}/members`, { user_id: userId }).then((r) => r.data),
  removeMember: (id, userId) => apiClient.delete(`/saved-filters/${id}/members/${userId}`).then((r) => r.data),
};
