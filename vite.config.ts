import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api/ghcontributions': {
        target: 'https://ghchart.rshah.org',
        changeOrigin: true, // Needed for virtual hosted sites
      },
    },
  },
});
