import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    setupFiles: ['__tests__/setup.ts'],
    css: false,
    // Avoid loading project postcss.config.mjs (Next/Tailwind)
    server: { deps: { inline: [] } },
  },
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
