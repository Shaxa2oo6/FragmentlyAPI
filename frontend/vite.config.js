import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { compression } from 'vite-plugin-compression2';

export default defineConfig({
  plugins: [
    react(),
    compression({
      algorithm: 'gzip',
      threshold: 1024,
      deleteOriginals: false,
    }),
    compression({
      algorithm: 'brotliCompress',
      threshold: 1024,
      deleteOriginals: false,
      skipIfLargerOrEqual: true,
    }),
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:8000',
      '/api/': 'http://localhost:8000',
      '/webhook': 'http://localhost:8000',
    },
  },
  preview: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 512,
    rollupOptions: {
      output: {
        // Vendor chunking: split heavy libs so the initial route loads less JS
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) {
              return 'charts';
            }
            if (id.includes('framer-motion')) {
              return 'motion';
            }
            if (id.includes('react-router')) {
              return 'router';
            }
            if (id.includes('react') || id.includes('scheduler')) {
              return 'react-vendor';
            }
            if (id.includes('axios') || id.includes('@tanstack')) {
              return 'data';
            }
            return 'vendor';
          }
        },
      },
    },
  },
});
