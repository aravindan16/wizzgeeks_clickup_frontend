import apiClient from '../../services/apiClient';

export const tasksApi = {
  list: (params) => apiClient.get('/tasks', { params }).then((r) => r.data),
  get: (id) => apiClient.get(`/tasks/${id}`).then((r) => r.data),
  create: (payload) => apiClient.post('/tasks', payload).then((r) => r.data),
  update: (id, payload) => apiClient.patch(`/tasks/${id}`, payload).then((r) => r.data),
  changeStatus: (id, payload) => apiClient.patch(`/tasks/${id}/status`, payload).then((r) => r.data),
  assign: (id, assignee_id) => apiClient.post(`/tasks/${id}/assign`, { assignee_id }).then((r) => r.data),
  worklog: (id, hours) => apiClient.post(`/tasks/${id}/worklog`, { hours }).then((r) => r.data),
  archive: (id) => apiClient.post(`/tasks/${id}/archive`).then((r) => r.data),
  remove: (id) => apiClient.delete(`/tasks/${id}`).then((r) => r.data),
  addWatcher: (id, user_id) => apiClient.post(`/tasks/${id}/watchers`, { user_id }).then((r) => r.data),
  removeWatcher: (id, user_id) => apiClient.delete(`/tasks/${id}/watchers/${user_id}`).then((r) => r.data),
  history: (id) => apiClient.get(`/tasks/${id}/history`).then((r) => r.data),
  activity: (id) => apiClient.get(`/tasks/${id}/activity`).then((r) => r.data),
  assignments: (id) => apiClient.get(`/tasks/${id}/assignments`).then((r) => r.data),
  metrics: (params) => apiClient.get('/tasks/metrics', { params }).then((r) => r.data),
  workflow: () => apiClient.get('/tasks/workflow').then((r) => r.data),
  comments: (id) => apiClient.get(`/tasks/${id}/comments`).then((r) => r.data),
  addComment: (id, body) => apiClient.post(`/tasks/${id}/comments`, { body }).then((r) => r.data),
  editComment: (cid, body) => apiClient.patch(`/tasks/comments/${cid}`, { body }).then((r) => r.data),
  deleteComment: (cid) => apiClient.delete(`/tasks/comments/${cid}`).then((r) => r.data),
  // subtasks
  subtasks: (id) => apiClient.get(`/tasks/${id}/subtasks`).then((r) => r.data),
  // issue links
  links: (id) => apiClient.get(`/tasks/${id}/links`).then((r) => r.data),
  addLink: (id, target_task_id, link_type) => apiClient.post(`/tasks/${id}/links`, { target_task_id, link_type }).then((r) => r.data),
  removeLink: (id, target_id) => apiClient.delete(`/tasks/${id}/links/${target_id}`).then((r) => r.data),
  // worklog entries
  worklogs: (id) => apiClient.get(`/tasks/${id}/worklogs`).then((r) => r.data),
  logWork: (id, hours, note) => apiClient.post(`/tasks/${id}/worklog`, { hours, note }).then((r) => r.data),
};

// Issue-link relationships, with the human label shown in the UI.
export const LINK_TYPES = [
  { value: 'relates_to', label: 'relates to' },
  { value: 'blocks', label: 'blocks' },
  { value: 'blocked_by', label: 'is blocked by' },
  { value: 'duplicates', label: 'duplicates' },
  { value: 'duplicated_by', label: 'is duplicated by' },
];

export const LINK_LABELS = Object.fromEntries(LINK_TYPES.map((l) => [l.value, l.label]));

export const STATUSES = [
  'backlog', 'planned', 'in_progress', 'blocked', 'review', 'testing', 'completed', 'closed',
];

export const STATUS_LABELS = {
  backlog: 'Backlog', planned: 'Planned', in_progress: 'In Progress', blocked: 'Blocked',
  review: 'Review', testing: 'Testing', completed: 'Completed', closed: 'Closed',
};

// ClickUp-style status groups (per-space custom workflows).
export const STATUS_GROUPS = [
  { key: 'not_started', label: 'Not started' },
  { key: 'active', label: 'Active' },
  { key: 'done', label: 'Done' },
  { key: 'closed', label: 'Closed' },
];

export const DEFAULT_SPACE_STATUSES = [
  { key: 'todo', name: 'TO DO', color: '#94a3b8', group: 'not_started' },
  { key: 'in_progress', name: 'IN PROGRESS', color: '#3b82f6', group: 'active' },
  { key: 'complete', name: 'COMPLETE', color: '#22c55e', group: 'closed' },
];

/**
 * Resolve a project/space's status workflow. The backend always returns
 * `project.statuses` (with a legacy fallback), but we guard for older objects.
 * Returns an ordered list of { key, name, color, group, order }.
 */
export function resolveStatuses(project) {
  const list = project?.statuses;
  if (Array.isArray(list) && list.length) {
    return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  return STATUSES.map((k, i) => ({ key: k, name: STATUS_LABELS[k], color: '#6b7280', group: 'active', order: i }));
}

// Quick lookup helpers from a resolved status list.
export const statusLabel = (sts, key) => sts.find((s) => s.key === key)?.name || STATUS_LABELS[key] || key;
export const statusColor = (sts, key) => sts.find((s) => s.key === key)?.color || '#6b7280';
export const isDoneStatus = (sts, key) => ['done', 'closed'].includes(sts.find((s) => s.key === key)?.group);

export const PRIORITIES = ['low', 'medium', 'high', 'critical'];

export const PRIORITY_COLOR = {
  low: '#6b7280', medium: '#2563eb', high: '#b45309', critical: '#b91c1c',
};

export const REQUIRES_NOTE = ['blocked'];

// Mirror of backend app/core/workflow.py — the workflow is fixed, so the UI can
// offer valid transitions without a network round-trip.
export const TRANSITIONS = {
  backlog: ['planned'],
  planned: ['in_progress', 'backlog'],
  in_progress: ['blocked', 'review', 'backlog'],
  blocked: ['in_progress'],
  review: ['in_progress', 'testing'],
  testing: ['in_progress', 'completed'],
  completed: ['closed', 'in_progress'],
  closed: ['backlog'],
};
