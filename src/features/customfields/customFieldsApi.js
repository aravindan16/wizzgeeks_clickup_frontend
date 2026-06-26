import apiClient from '../../services/apiClient';

export const customFieldsApi = {
  list: (spaceId, listId, taskId, opts) =>
    apiClient.get('/custom-fields', { params: { space_id: spaceId, list_id: listId || undefined, task_id: taskId || undefined }, ...(opts || {}) }).then((r) => r.data),
  listAll: (spaceId) =>
    apiClient.get('/custom-fields', { params: { space_id: spaceId, all: true } }).then((r) => r.data),
  reusable: (spaceId, listId) =>
    apiClient.get('/custom-fields/reusable', { params: { space_id: spaceId, list_id: listId || undefined } }).then((r) => r.data),
  create: (payload) => apiClient.post('/custom-fields', payload).then((r) => r.data),
  update: (id, payload) => apiClient.patch(`/custom-fields/${id}`, payload).then((r) => r.data),
  move: (id, payload) => apiClient.post(`/custom-fields/${id}/move`, payload).then((r) => r.data),
  reorder: (ids) => apiClient.post('/custom-fields/reorder', { ids }).then((r) => r.data),
  // Enable/disable an inherited (Space) field for a single List.
  setListEnabled: (id, listId, enabled) =>
    apiClient.post(`/custom-fields/${id}/list-toggle`, { list_id: listId, enabled }).then((r) => r.data),
  duplicate: (id, payload) => apiClient.post(`/custom-fields/${id}/duplicate`, payload).then((r) => r.data),
  remove: (id) => apiClient.delete(`/custom-fields/${id}`).then((r) => r.data),
};

// Only these three types are supported.
export const FIELD_TYPES = [
  { value: 'dropdown', label: 'Dropdown', icon: '▼', desc: 'Choose from colored options' },
  { value: 'relationship', label: 'Relationship', icon: '🔗', desc: 'Link Task ↔ Task / Subtask' },
  { value: 'text', label: 'Text', icon: '≡', desc: 'Single or multi-line text' },
];
export const FIELD_TYPE_LABEL = Object.fromEntries(FIELD_TYPES.map((t) => [t.value, t.label]));
export const FIELD_TYPE_ICON = Object.fromEntries(FIELD_TYPES.map((t) => [t.value, t.icon]));
