import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: { 'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['test/setup.ts'],
    include: ['**/*.test.{ts,tsx,mjs}'],
    exclude: ['node_modules/**', '.next/**'],
  },
});
