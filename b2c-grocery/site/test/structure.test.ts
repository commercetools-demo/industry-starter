/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// @vitest-environment node
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const dirs = [
  'app/[locale]', 'app/api/auth', 'app/api/account', 'app/api/cart', 'app/api/checkout',
  'lib/ct', 'lib/mappers', 'hooks', 'context', 'components/ui', 'components/layout', 'components/product',
  'i18n', 'messages', 'test',
];

describe('project structure', () => {
  it.each(dirs)('Scaffold complete: %s exists', (d) => {
    expect(existsSync(path.join(root, d))).toBe(true);
  });
});
