import axios from 'axios';

// API manzili hostname'dan avtomatik aniqlanadi:
//   - localhost / rivojlantirish  -> VITE_API_URL yoki http://localhost:8000
//   - boshqa host                 -> https://api.<hostname> (masalan api.fragmently.io)
// Aniq VITE_API_URL berilsa (localhost bo'lmasa) har doim ustuvor hisoblanadi.
const CONFIGURED_API_URL = import.meta.env.VITE_API_URL;
const HAS_EXPLICIT_API_URL = !!CONFIGURED_API_URL && !/localhost|127\.0\.0\.1/.test(CONFIGURED_API_URL);

function resolveApiBaseUrl() {
  if (typeof window === 'undefined') {
    return CONFIGURED_API_URL || 'http://localhost:8000';
  }

  const { protocol, hostname, port } = window.location;
  const cleanHost = String(hostname || '')
    .toLowerCase()
    .replace(/^www\./, '');
  const isLocal = !cleanHost || ['localhost', '127.0.0.1', '::1'].includes(cleanHost);

  if (isLocal) {
    return CONFIGURED_API_URL || 'http://localhost:8000';
  }

  if (HAS_EXPLICIT_API_URL) {
    return CONFIGURED_API_URL;
  }

  const suffix = port && ![80, 443].includes(Number(port)) ? `:${port}` : '';
  return `${protocol}//api.${cleanHost}${suffix}`;
}

const BASE_URL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        const res = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token } = res.data;
        localStorage.setItem('access_token', access_token);
        api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        delete api.defaults.headers.common['Authorization'];
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);