import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/governance': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api/dealflow': {
        target: 'http://127.0.0.1:8069',
        changeOrigin: true,
      },
      '/dealflow/portal': {
        target: 'http://127.0.0.1:8069',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
