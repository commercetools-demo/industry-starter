import { defineConfig, loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath } from 'node:url';

// Read-only live probe (`npm run test:live`). Not part of `npm run check`.
// Values come from the git-ignored storefront/.env.local; nothing is printed or written except names and counts.
export default defineConfig(({ mode }) => ({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: { 'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['**/*.live.ts'],
    exclude: ['node_modules/**', '.next/**'],
    env: loadEnv(mode, process.cwd(), ''),
    testTimeout: 30000,
  },
}));
