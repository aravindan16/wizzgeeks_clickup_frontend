import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Always use 5173 (the Google OAuth authorized origin). Fail loudly instead
    // of silently drifting to 5174/5178 where the Google Sign-In button won't render.
    strictPort: true,
  },
});
