import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15000,
});

const PUBLIC_AUTH_PATHS = ['/login', '/register'];

const redirectToLogin = () => {
  if (typeof window === 'undefined') return;
  const currentPath = window.location.pathname;
  if (!PUBLIC_AUTH_PATHS.includes(currentPath)) {
    window.location.replace('/login');
  }
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      redirectToLogin();
    }
    return Promise.reject(error);
  }
);

export const AuthAPI = {
  login: (payload) => api.post('/auth/login', payload),
  register: (payload) => api.post('/auth/register', payload),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const DocumentAPI = {
  list: () => api.get('/documents'),
  create: (payload) => api.post('/documents', payload),
  get: (id) => api.get(`/documents/${id}`),
  update: (id, payload) => api.put(`/documents/${id}`, payload),
  remove: (id) => api.delete(`/documents/${id}`),
  share: (id, payload) => api.post(`/documents/${id}/share`, payload),
  shareByEmail: (id, payload) => api.post(`/documents/${id}/share-email`, payload),
  permissions: (id) => api.get(`/documents/${id}/permissions`),
  revokePermission: (id, userId) => api.delete(`/documents/${id}/permissions/${userId}`),
};

export const AIAPI = {
  grammar: (text) => api.post('/ai/grammar-check', { text }),
  enhance: (text) => api.post('/ai/enhance', { text }),
  summarize: (text) => api.post('/ai/summarize', { text }),
  complete: (text) => api.post('/ai/complete', { text }),
  suggestions: (text) => api.post('/ai/suggestions', { text }),
};

export default api;

