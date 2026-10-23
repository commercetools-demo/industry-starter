import { defineConfig } from 'vitest/config';

// Only for scripts/mock-fixtures/generate.gen.ts (not part of `npm test`).
export default defineConfig({
  root: process.cwd(),
  test: { environment: 'node', include: ['scripts/mock-fixtures/generate.gen.ts'] },
});
