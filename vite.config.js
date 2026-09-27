import { defineConfig } from 'vite';

// Relative base so the same build works on GitHub Pages (/blocks/) and inside the Android app
export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 1000 },
});
