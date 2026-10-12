// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const load = vi.hoisted(() => vi.fn());
vi.mock('@/lib/product/load', () => ({ getProductPage: load }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import ProductLayout from './layout';

const params = (slug: string, locale = 'en-US') => Promise.resolve({ locale, store: 'mau-reseller-north', slug });
beforeEach(() => load.mockReset());

describe('product layout (real 404 above the loading boundary)', () => {
  it('a missing or withdrawn part is not-found before anything streams', async () => {
    load.mockResolvedValue({ kind: 'not-found' });
    await expect(ProductLayout({ children: 'x', params: params('withdrawn') })).rejects.toThrow('NEXT_NOT_FOUND');
  });
  it('an existing part renders its children', async () => {
    load.mockResolvedValue({ kind: 'ok' });
    expect(await ProductLayout({ children: 'child', params: params('ok') })).toBe('child');
  });
  it('an unknown locale is not-found without a read', async () => {
    await expect(ProductLayout({ children: 'x', params: params('ok', 'fr-FR') })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(load).not.toHaveBeenCalled();
  });
});
