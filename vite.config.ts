import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['habitat-furnished-application-reynolds.trycloudflare.com'],
  },
  preview: {
    allowedHosts: ['habitat-furnished-application-reynolds.trycloudflare.com'],
  },
});
