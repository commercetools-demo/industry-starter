import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '.'),
      // `server-only` throws outside a React Server environment; tests stub it.
      'server-only': resolve(import.meta.dirname, 'test/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    // next-intl imports 'next/navigation' without an extension; inline it so Vite resolves it.
    server: { deps: { inline: ['next-intl'] } },
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**'],
  },
});
