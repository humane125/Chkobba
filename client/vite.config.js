import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'unrubbed-anson-convolutional.ngrok-free.dev',
      process.env.VITE_ALLOWED_HOST,
    ].filter(Boolean),
  },
});
