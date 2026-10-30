import { describe, expect, it, vi } from 'vitest';
import type { ProductPageData } from '@/lib/types';

vi.mock('react', async (orig) => {
  const actual = await orig<typeof import('react')>();
  return { ...actual, cache: <T extends () => unknown>(fn: T) => { let v: unknown; return (() => (v ??= fn())) as T; } };
});
vi.mock('server-only', () => ({}));

describe('requestProduct', () => {
  it('is null before a route provides a product, then the same product for every component', async () => {
    const { provideProduct, requestProduct } = await import('./request-product');
    expect(requestProduct()).toBeNull();
    const data = { product: { id: 'p1' } } as unknown as ProductPageData;
    provideProduct(data);
    expect(requestProduct()).toBe(data);
    expect(requestProduct()).toBe(data);
  });
});
