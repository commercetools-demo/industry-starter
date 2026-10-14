/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { vi } from 'vitest';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

import CatchAllPage from './page';

describe('catch-all page', () => {
  it('Unknown locale URL: calls notFound', () => {
    expect(() => CatchAllPage()).toThrow('NOT_FOUND');
  });
});
