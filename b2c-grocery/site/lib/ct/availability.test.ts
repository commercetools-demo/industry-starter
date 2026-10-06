import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
const execute = vi.fn();
vi.mock('./client', () => ({
  getApiRoot: () => ({ inventory: () => ({ get: (arg: unknown) => (get(arg), { execute }) }) }),
}));

import { getAvailableQuantity } from './availability';

beforeEach(() => {
  vi.clearAllMocks();
  execute.mockReset();
});

describe('getAvailableQuantity', () => {
  it('returns the available quantity of the inventory entry', async () => {
    execute.mockResolvedValue({ body: { results: [{ sku: 'MILK-1L', quantityOnStock: 100, availableQuantity: 42 }] } });
    expect(await getAvailableQuantity('MILK-1L')).toBe(42);
    expect(get.mock.calls[0][0].queryArgs.where).toBe('sku="MILK-1L"');
  });

  it('no inventory entry: 0', async () => {
    execute.mockResolvedValue({ body: { results: [] } });
    expect(await getAvailableQuantity('GHOST')).toBe(0);
  });

  it('sums entries (e.g. supply channels) and ignores negatives', async () => {
    execute.mockResolvedValue({ body: { results: [{ availableQuantity: 3 }, { availableQuantity: 4 }, { availableQuantity: -2 }] } });
    expect(await getAvailableQuantity('MILK-1L')).toBe(7);
  });

  it('escapes quotes in the SKU so the predicate cannot be broken', async () => {
    execute.mockResolvedValue({ body: { results: [] } });
    await getAvailableQuantity('A"B');
    expect(get.mock.calls[0][0].queryArgs.where).toBe('sku="A\\"B"');
  });

  it('is read on every call (never cached)', async () => {
    execute.mockResolvedValue({ body: { results: [{ availableQuantity: 1 }] } });
    await getAvailableQuantity('MILK-1L');
    await getAvailableQuantity('MILK-1L');
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
