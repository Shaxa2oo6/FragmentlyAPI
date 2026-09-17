import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // .env faylidan sozlamalarni o'qiymiz (VITE_DEV_PORT, VITE_API_BASE_URL).
  const env = loadEnv(mode, process.cwd(), '');

  // Dev/preview port — .env'dagi VITE_DEV_PORT, bo'lmasa 5177.
  const devPort = Number(env.VITE_DEV_PORT || env.VITE_ADMIN_PORT || 5177);

  // Proxy target — admin backend manzili (.env VITE_API_BASE_URL).
  const proxyTarget = env.VITE_API_BASE_URL || 'http://localhost:8001';

  return {
    plugins: [react()],
    server: {
      host: true,
      port: devPort,
      strictPort: true,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
      proxy: {
        '/api/': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: true,
      port: devPort,
      strictPort: true,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
    },
  };
});
