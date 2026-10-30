// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { podPage } from '@/test/pdp';

const h = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, v: Record<string, number>) =>
    key === 'variant.intensity' ? `Intensity ${v.n}` : key === 'variant.capsules' ? `${v.count} capsules` : `${v.n} g`,
}));
vi.mock('@/lib/pdp/load', () => ({ loadProductPage: h.load }));

import { getScanProduct } from './instore-scan';

beforeEach(() => {
  h.load.mockReset();
  h.load.mockImplementation(async (sku: string) => (sku === 'POD-50' ? podPage() : null));
});

describe('getScanProduct', () => {
  it('maps the product page of the scanned SKU', async () => {
    const p = await getScanProduct('POD-50', 'en-US');
    expect(p).toMatchObject({ sku: 'POD-50', name: 'Ember Ristretto', variant: 'Intensity 12 · 50 capsules' });
    expect(h.load).toHaveBeenCalledWith('POD-50', 'en-US');
  });

  it('a SKU typed in lower case is tried again in upper case', async () => {
    const p = await getScanProduct('pod-50', 'en-US');
    expect(p?.sku).toBe('POD-50');
    expect(h.load.mock.calls.map((c) => c[0])).toEqual(['pod-50', 'POD-50']);
  });

  it('an unknown code is null, and so is a hit that is not a variant of the product found', async () => {
    expect(await getScanProduct('NOPE', 'en-US')).toBeNull();
    h.load.mockImplementation(async () => podPage()); // the search matched, but this exact SKU is not one of its variants
    expect(await getScanProduct('POD-777', 'en-US')).toBeNull();
  });
});
