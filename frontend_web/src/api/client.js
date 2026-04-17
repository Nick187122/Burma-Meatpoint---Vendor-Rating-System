import axios from 'axios';
import useAuthStore from '../store/authStore';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');

const client = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Important for HTTP-only refresh cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach access token
client.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 & Auto-Refresh Token
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Attempt to get a new access token using the HTTP-only refresh cookie
        const res = await axios.post(
          `${API_URL}/auth/token/refresh/`,
          {},
          { withCredentials: true }
        );

        const newAccess = res.data.access;
        // Update store with new token
        useAuthStore.getState().setToken(newAccess);

        // Update authorization header and retry original request
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return client(originalRequest);
      } catch (refreshError) {
        // If refresh fails (e.g. refresh token expired), auto logout
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default client;
