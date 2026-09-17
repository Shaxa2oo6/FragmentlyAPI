import axios from 'axios';

// API manzili hostname'dan avtomatik aniqlanadi:
//   - localhost / rivojlantirish  -> VITE_API_BASE_URL yoki http://localhost:8001
//   - boshqa host                 -> VITE_API_BASE_URL (sozlangan bo'lsa) yoki
//                                    https://api.<hostname> (masalan api.fragmently.uz)
const CONFIGURED_API_URL = import.meta.env.VITE_API_BASE_URL;
const HAS_EXPLICIT_API_URL = !!CONFIGURED_API_URL && !/localhost|127\.0\.0\.1/.test(CONFIGURED_API_URL);

export function resolveApiBaseUrl() {
  if (typeof window === 'undefined') {
    return CONFIGURED_API_URL || 'http://localhost:8001';
  }

  const { protocol, hostname, port } = window.location;
  const cleanHost = String(hostname || '')
    .toLowerCase()
    .replace(/^www\./, '');
  const isLocal = !cleanHost || ['localhost', '127.0.0.1', '::1'].includes(cleanHost);

  if (isLocal) {
    return CONFIGURED_API_URL || 'http://localhost:8001';
  }

  if (HAS_EXPLICIT_API_URL) {
    return CONFIGURED_API_URL;
  }

  const suffix = port && ![80, 443].includes(Number(port)) ? `:${port}` : '';
  return `${protocol}//api.${cleanHost}${suffix}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
