/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('./stock', () => ({ countOutOfStockEverywhere: vi.fn(async () => 0) }));

import { getHeadsUp } from './heads-up';

describe('heads-up', () => {
  it('0 gives null; error gives null; href starts with slash', async () => {
    expect(await getHeadsUp('s', async () => 0)).toBeNull();
    expect(await getHeadsUp('s', async () => Promise.reject(new Error('down')))).toBeNull();
    const banner = await getHeadsUp('s', async () => 3);
    expect(banner).toMatchObject({ count: 3, kind: 'out-of-stock-everywhere' });
    expect(banner?.href.startsWith('/')).toBe(true);
    expect(banner?.href.startsWith('//')).toBe(false);
  });
});
