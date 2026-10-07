// @vitest-environment node
const read = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ getApiRoot: () => ({ inventory: () => ({ get: (args: unknown) => ({ execute: () => read(args) }) }) }) }));
vi.mock('./timeout', () => ({ withTimeout: (promise: Promise<unknown>) => promise }));

import { getAvailableQuantities, getAvailableQuantity } from './availability';

beforeEach(() => read.mockReset());

describe('getAvailableQuantities', () => {
  it('asks once for several SKUs', async () => {
    read.mockResolvedValue({ body: { results: [{ sku: 'A', availableQuantity: 4 }, { sku: 'B', availableQuantity: 1 }] } });
    await expect(getAvailableQuantities(['A', 'B', 'A'])).resolves.toEqual({ A: 4, B: 1 });
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0]?.[0]).toEqual({ queryArgs: { where: 'sku in ("A","B")', limit: 100 } });
  });

  it('a physical SKU without an entry has 0', async () => {
    read.mockResolvedValue({ body: { results: [] } });
    await expect(getAvailableQuantity('GHOST')).resolves.toBe(0);
  });

  it('services are not queried: an empty list makes no call', async () => {
    await expect(getAvailableQuantities([])).resolves.toEqual({});
    expect(read).not.toHaveBeenCalled();
  });

  it('sums the entries of a SKU across channels and never goes negative', async () => {
    read.mockResolvedValue({ body: { results: [{ sku: 'A', availableQuantity: 2 }, { sku: 'A', availableQuantity: 3 }, { sku: 'B', availableQuantity: -1 }] } });
    await expect(getAvailableQuantities(['A', 'B'])).resolves.toEqual({ A: 5, B: 0 });
  });
});
