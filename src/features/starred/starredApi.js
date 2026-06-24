import apiClient from '../../services/apiClient';

export const starredApi = {
  list: (params) => apiClient.get('/starred', { params }).then((r) => r.data),
  star: (item) => apiClient.post('/starred', item).then((r) => r.data),
  unstar: (entityType, entityId) =>
    apiClient.delete(`/starred/${entityType}/${entityId}`).then((r) => r.data),
};
