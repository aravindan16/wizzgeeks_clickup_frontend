import apiClient from '../../services/apiClient';

export const usersApi = {
  list: (params) => apiClient.get('/users', { params }).then((r) => r.data),
  create: (payload) => apiClient.post('/users', payload).then((r) => r.data),
  update: (id, payload) => apiClient.patch(`/users/${id}`, payload).then((r) => r.data),
  disable: (id) => apiClient.post(`/users/${id}/disable`).then((r) => r.data),
  activate: (id) => apiClient.post(`/users/${id}/activate`).then((r) => r.data),
  resetPassword: (id, newPassword) =>
    apiClient.post(`/users/${id}/reset-password`, { new_password: newPassword }).then((r) => r.data),
  roles: () => apiClient.get('/roles').then((r) => r.data),
  myProfile: () => apiClient.get('/users/me/profile').then((r) => r.data),
  updateMyProfile: (payload) => apiClient.patch('/users/me/profile', payload).then((r) => r.data),
  // Persist UI/theme prefs (theme, accent) — saved to the DB so they follow the user.
  updatePreferences: (payload) => apiClient.patch('/users/me/preferences', payload).then((r) => r.data),
  uploadAvatar: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiClient.post('/users/me/avatar', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
  removeAvatar: () => apiClient.delete('/users/me/avatar').then((r) => r.data),
};

