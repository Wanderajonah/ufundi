import axios from 'axios';

// Base URL for the admin dashboard API. Override per environment with
// VITE_API_BASE (e.g. create web/.env.local with
// VITE_API_BASE=http://localhost:5000 to run against a local backend).
// Defaults to the production backend.
const API_BASE = import.meta.env.VITE_API_BASE || 'https://fundilinkug.onrender.com';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
});

export { API_BASE };

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // A 401 from the login endpoint is an expected outcome (bad credentials),
    // not a session-expiry event. Only treat 401s on authenticated requests as
    // "session expired", and avoid a redundant reload if already on /login.
    const isLoginRequest = err.config?.url?.includes('/admin/login');
    if (err.response?.status === 401 && !isLoginRequest && window.location.pathname !== '/login') {
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
      window.location.assign('/login');
    }
    return Promise.reject(err);
  },
);

export const login = (email, password) => api.post('/admin/login', { email, password });
export const getStats = () => api.get('/admin/stats');
export const getAnalytics = () => api.get('/admin/analytics');

export const getFundis = (params) => api.get('/admin/fundis', { params });
export const verifyFundi = (id, notes) => api.patch(`/admin/fundis/${id}/verify`, { status: 'verified', notes });
export const rejectFundi = (id, notes) => api.patch(`/admin/fundis/${id}/verify`, { status: 'rejected', notes });
export const deleteFundi = (id) => api.delete(`/admin/fundis/${id}`);

export const getClients = (params) => api.get('/admin/users', { params });
export const suspendClient = (id) => api.patch(`/admin/users/${id}/status`, { status: 'suspended' });
export const reactivateClient = (id) => api.patch(`/admin/users/${id}/status`, { status: 'active' });
export const deleteUser = (id) => api.delete(`/admin/users/${id}`);
export const createUser = (data) => api.post('/admin/users', data);

export const getBookings = (params) => api.get('/admin/bookings', { params });
export const updateBookingStatus = (id, status) => api.patch(`/admin/bookings/${id}/status`, { status });

export const getDisputes = (params) => api.get('/admin/disputes', { params });
export const resolveDispute = (id, resolution) => api.patch(`/admin/disputes/${id}/resolve`, { resolution });

export const getPayments = (params) => api.get('/admin/payments', { params });
export const releaseEscrow = (id) => api.patch(`/admin/payments/${id}/release`);

export const getReviews = (params) => api.get('/admin/reviews', { params });
export const deleteReview = (id) => api.delete(`/admin/reviews/${id}`);

export const getNotifications = (params) => api.get('/admin/notifications', { params });
export const markNotificationRead = (id) => api.patch(`/admin/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.patch('/admin/notifications/read-all');

export const getSettings = () => api.get('/admin/settings');
export const updateSettings = (data) => api.put('/admin/settings', data);

export default api;
