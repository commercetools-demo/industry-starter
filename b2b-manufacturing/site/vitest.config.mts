/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname), 'server-only': path.resolve(import.meta.dirname, 'test/server-only-stub.ts') } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.test.{ts,tsx,mjs}'],
    exclude: ['node_modules/**', '.next/**', 'eslint/fixtures/**'],
    // next-intl imports `next/navigation` without an extension; inline it so Vite resolves it.
    server: { deps: { inline: ['next-intl'] } },
  },
});
