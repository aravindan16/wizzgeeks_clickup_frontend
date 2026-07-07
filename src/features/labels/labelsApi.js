import apiClient from '../../services/apiClient';

// Global label catalog (workspace-wide, reusable on any task in any Space/List).
export const labelsApi = {
  list: () => apiClient.get('/labels').then((r) => r.data.items || []),
  // Get-or-create by name — returns the existing label if the name already exists.
  create: (name, color) => apiClient.post('/labels', { name, ...(color ? { color } : {}) }).then((r) => r.data),
  remove: (id) => apiClient.delete(`/labels/${id}`).then((r) => r.data),
};
