import apiClient from '../../services/apiClient';

/**
 * Roles & permissions API. The permission catalog is read from the DB (never
 * hardcoded in the frontend); roles support full CRUD.
 */
export const rolesApi = {
  catalog: () => apiClient.get('/roles/permissions/catalog').then((r) => r.data),
  list: () => apiClient.get('/roles').then((r) => r.data),
  // Roles for the Permission setting page — gated by `permission.manage`.
  manageList: () => apiClient.get('/roles/manage').then((r) => r.data),
  create: (payload) => apiClient.post('/roles', payload).then((r) => r.data),
  update: (id, payload) => apiClient.patch(`/roles/${id}`, payload).then((r) => r.data),
  remove: (id) => apiClient.delete(`/roles/${id}`).then((r) => r.data),
};
