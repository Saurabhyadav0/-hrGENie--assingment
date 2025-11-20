import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxy = process.env.VITE_API_PROXY || 'http://localhost:5001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: apiProxy,
        changeOrigin: true,
      },
      '/socket.io': {
        target: apiProxy,
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
