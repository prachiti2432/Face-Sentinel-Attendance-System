import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    hmr: {
      overlay: false // Disable overlay to prevent errors from model files
    },
    fs: {
      // Allow serving files from public directory
      strict: false
    }
  },
  publicDir: 'public'
});
