import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      { find: /^zustand$/, replacement: fileURLToPath(new URL('./node_modules/zustand/esm/index.js', import.meta.url)) },
      { find: /^zustand\/vanilla$/, replacement: fileURLToPath(new URL('./node_modules/zustand/esm/vanilla.js', import.meta.url)) },
    ],
  },
  build: {
    cssMinify: false,
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/v1': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api/governance': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api/dealflow': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/dealflow/portal': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
