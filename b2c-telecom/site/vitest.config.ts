/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      // the real package throws outside a server bundle
      'server-only': path.resolve(__dirname, 'test/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    server: { deps: { inline: ['next-intl'] } }, // next-intl's ESM imports next/navigation without an extension
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
  },
});
