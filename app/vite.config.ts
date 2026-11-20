/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

/**
 * Політика безпеки вмісту (CSP). Додається лише у production-збірку,
 * бо dev-сервер Vite використовує вбудовані скрипти для гарячого оновлення.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'autoqa-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

// base: './' - відносні шляхи, щоб збірку можна було розмістити
// в будь-якому підкаталозі (наприклад, GitHub Pages /FRONTLAB/STEM/app/dist/).
export default defineConfig({
  base: './',
  plugins: [react(), cspPlugin()],
  build: {
    target: ['es2020', 'chrome100', 'edge100', 'firefox100', 'safari14'],
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  worker: { format: 'es' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/store/**', 'src/components/**'],
      exclude: ['src/lib/runner.worker.ts', 'src/lib/seed.ts'],
    },
  },
});
