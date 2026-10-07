import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname) } }, // B adds the 'server-only' alias
  test: {
    environment: 'jsdom',
    server: { deps: { inline: ['next-intl'] } }, // next-intl's ESM imports next/navigation without an extension
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
  },
});
