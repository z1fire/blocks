import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

const build = process.env.GITHUB_RUN_NUMBER;
const version = build ? pkg.version.replace(/\.\d+$/, `.${build}`) : `${pkg.version}-dev`;

// Relative base so the same build works on GitHub Pages (/blocks/) and inside the Android app
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { target: 'es2020', chunkSizeWarningLimit: 1000 },
});
