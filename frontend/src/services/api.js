import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: inyectar JWT automáticamente en todas las peticiones
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('documind_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: redirigir a login si el token expira (401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('documind_token');
      localStorage.removeItem('documind_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  register: (data) => api.post('/auth/register', data),
};

// ─── Documents ───────────────────────────────────────────────────────────────
export const documentsAPI = {
  upload: (formData) =>
    api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  list: (params) => api.get('/documents', { params }),
  getById: (id) => api.get(`/documents/${id}`),
  delete: (id) => api.delete(`/documents/${id}`),
};

// ─── Chat RAG ────────────────────────────────────────────────────────────────
export const chatAPI = {
  query: (query, repositorio_id, thread_id) =>
    api.post('/chat/query', { query, repositorio_id: repositorio_id || undefined, thread_id }),
  getThreads: (repositorio_id) => api.get('/chat/threads', { params: { repositorio_id } }),
  createThread: (titulo, repositorio_id) => api.post('/chat/threads', { titulo, repositorio_id }),
  getMessages: (threadId) => api.get(`/chat/threads/${threadId}/messages`),
  deleteThread: (threadId) => api.delete(`/chat/threads/${threadId}`),
};

// ─── Repositories ────────────────────────────────────────────────────────────
export const repositoriesAPI = {
  list: () => api.get('/repositories'),
  create: (data) => api.post('/repositories', data),
  delete: (id) => api.delete(`/repositories/${id}`),
};

// ─── Logs / Dashboard ────────────────────────────────────────────────────────
export const logsAPI = {
  list: (params) => api.get('/logs', { params }),
  dashboard: () => api.get('/logs/dashboard'),
};

// ─── PQRS & Mesa de Ayuda ─────────────────────────────────────────────────────
export const pqrsAPI = {
  list: (params) => api.get('/pqrs', { params }),
  getById: (ticketId) => api.get(`/pqrs/${ticketId}`),
  updateStatus: (ticketId, data) => api.put(`/pqrs/${ticketId}/estado`, data),
  getKpis: () => api.get('/pqrs/kpis'),
};

export default api;
