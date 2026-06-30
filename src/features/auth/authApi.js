import apiClient from '../../services/apiClient';

export const authApi = {
  login: (email, password) =>
    apiClient.post('/auth/login', { email, password }).then((r) => r.data),
  google: (idToken) => apiClient.post('/auth/google', { id_token: idToken }).then((r) => r.data),
  logout: () => apiClient.post('/auth/logout').then((r) => r.data),
  refresh: () => apiClient.post('/auth/refresh').then((r) => r.data),
  me: () => apiClient.get('/auth/me').then((r) => r.data),
  forgotPassword: (email) =>
    apiClient.post('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (token, new_password) =>
    apiClient.post('/auth/reset-password', { token, new_password }).then((r) => r.data),
  changePassword: (current_password, new_password) =>
    apiClient
      .post('/auth/change-password', { current_password, new_password })
      .then((r) => r.data),
};
