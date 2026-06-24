import apiClient from '../../services/apiClient';

export const recentApi = {
  list: () => apiClient.get('/recent').then((r) => r.data),
  record: (item) => apiClient.post('/recent', item).then((r) => r.data),
  clear: () => apiClient.delete('/recent').then((r) => r.data),
};
