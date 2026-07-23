import apiClient from '../../services/apiClient';

// All chat requests run "silent" so they never flash the global loading overlay —
// chat should feel instant. Reads also pass `_nodedupe` so the 60s GET cache
// never serves stale conversations/messages.
const SILENT = { _silent: true };
const SILENT_FRESH = { _silent: true, _nodedupe: true };

/** Chat API: conversations (DM + group), messages, contacts. */
export const chatApi = {
  contacts: () => apiClient.get('/chat/contacts', SILENT_FRESH).then((r) => r.data.items),
  conversations: () => apiClient.get('/chat/conversations', SILENT_FRESH).then((r) => r.data.items),
  getConversation: (id) => apiClient.get(`/chat/conversations/${id}`, SILENT_FRESH).then((r) => r.data),
  createDirect: (userId) => apiClient.post('/chat/conversations/direct', { user_id: userId }, SILENT).then((r) => r.data),
  createGroup: (name, memberIds) => apiClient.post('/chat/conversations/group', { name, member_ids: memberIds }, SILENT).then((r) => r.data),
  messages: (id, { skip = 0, limit = 30 } = {}) =>
    apiClient.get(`/chat/conversations/${id}/messages`, { params: { skip, limit }, ...SILENT_FRESH }).then((r) => r.data),
  pinned: (id) => apiClient.get(`/chat/conversations/${id}/pinned`, SILENT_FRESH).then((r) => r.data.items),
  upload: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiClient.post('/chat/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' }, _silent: true }).then((r) => r.data);
  },
  setGroupAvatar: (convId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiClient.post(`/chat/conversations/${convId}/avatar`, fd, { headers: { 'Content-Type': 'multipart/form-data' }, _silent: true }).then((r) => r.data);
  },
  createPoll: (convId, question, options, multi) =>
    apiClient.post(`/chat/conversations/${convId}/poll`, { question, options, multi }, SILENT).then((r) => r.data),
  vote: (msgId, optionId) => apiClient.post(`/chat/messages/${msgId}/vote`, { option_id: optionId }, SILENT).then((r) => r.data),
  send: (id, body, replyToId, attachment) =>
    apiClient.post(`/chat/conversations/${id}/messages`, { body, reply_to_id: replyToId || null, attachment: attachment || null }, SILENT).then((r) => r.data),
  markRead: (id) => apiClient.post(`/chat/conversations/${id}/read`, null, SILENT).then((r) => r.data),
  // message actions
  bookmarks: () => apiClient.get('/chat/bookmarks', SILENT_FRESH).then((r) => r.data.items),
  edit: (msgId, body) => apiClient.patch(`/chat/messages/${msgId}`, { body }, SILENT).then((r) => r.data),
  remove: (msgId) => apiClient.delete(`/chat/messages/${msgId}`, SILENT).then((r) => r.data),
  react: (msgId, emoji) => apiClient.post(`/chat/messages/${msgId}/react`, { emoji }, SILENT).then((r) => r.data),
  pin: (msgId, pinned) => apiClient.post(`/chat/messages/${msgId}/pin`, { pinned }, SILENT).then((r) => r.data),
  bookmark: (msgId, bookmarked) => apiClient.post(`/chat/messages/${msgId}/bookmark`, { bookmarked }, SILENT).then((r) => r.data),
  forward: (msgId, conversationId) => apiClient.post(`/chat/messages/${msgId}/forward`, { conversation_id: conversationId }, SILENT).then((r) => r.data),
};
