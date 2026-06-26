import apiClient from '../../services/apiClient';

export const projectsApi = {
  list: (params) => apiClient.get('/projects', { params }).then((r) => r.data),
  get: (id) => apiClient.get(`/projects/${id}`).then((r) => r.data),
  stats: (id) => apiClient.get(`/projects/${id}/stats`).then((r) => r.data),
  activity: (id) => apiClient.get(`/projects/${id}/activity`).then((r) => r.data),
  create: (payload) => apiClient.post('/projects', payload).then((r) => r.data),
  update: (id, payload) => apiClient.patch(`/projects/${id}`, payload).then((r) => r.data),
  archive: (id) => apiClient.post(`/projects/${id}/archive`).then((r) => r.data),
  remove: (id) => apiClient.delete(`/projects/${id}`).then((r) => r.data),
  members: (id, opts) => apiClient.get(`/projects/${id}/members`, opts).then((r) => r.data),
  addMember: (id, payload) =>
    apiClient.post(`/projects/${id}/members`, payload).then((r) => r.data),
  updateMember: (id, userId, payload) =>
    apiClient.patch(`/projects/${id}/members/${userId}`, payload).then((r) => r.data),
  removeMember: (id, userId) =>
    apiClient.delete(`/projects/${id}/members/${userId}`).then((r) => r.data),
  statusTemplates: () => apiClient.get('/projects/status-templates').then((r) => r.data),
  saveStatusTemplate: (name, statuses) =>
    apiClient.post('/projects/status-templates', { name, statuses }).then((r) => r.data),
};

export const PROJECT_ROLES = [
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'team_lead', label: 'Team Lead' },
  { value: 'developer', label: 'Developer' },
  { value: 'tester', label: 'Tester' },
];

export const PROJECT_STATUSES = ['active', 'on_hold', 'completed', 'archived'];
