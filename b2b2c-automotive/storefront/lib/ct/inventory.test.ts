// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const inventoryGet = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ apiRoot: { inventory: () => ({ get: (args: unknown) => ({ execute: () => inventoryGet(args) }) }) }, projectKey: 'p' }));

import { getLineStock, splitStock } from './inventory';

beforeEach(() => inventoryGet.mockReset());

describe('splitStock: lib/ct/inventory', () => {
  it('all from store', () => {
    expect(splitStock(3, { branchQty: 5, masterQty: 100 })).toEqual({ fromStore: 3, shipsLater: 0, capped: false });
  });
  it('part from store part later', () => {
    expect(splitStock(8, { branchQty: 5, masterQty: 100 })).toEqual({ fromStore: 5, shipsLater: 3, capped: false });
  });
  it('none anywhere caps to zero and the line is flagged', () => {
    expect(splitStock(2, { branchQty: 0, masterQty: 0 })).toEqual({ fromStore: 0, shipsLater: 0, capped: true });
  });
  it('caps when the warehouse cannot cover the rest', () => {
    expect(splitStock(10, { branchQty: 2, masterQty: 3 })).toEqual({ fromStore: 2, shipsLater: 3, capped: true });
  });
});

describe('getLineStock: lib/ct/inventory', () => {
  it('one inventory call for many lines', async () => {
    inventoryGet.mockResolvedValue({
      body: {
        results: [
          { sku: 'A', availableQuantity: 4, supplyChannel: { typeId: 'channel', id: 'ch-branch' } },
          { sku: 'A', availableQuantity: 200, supplyChannel: { typeId: 'channel', id: 'ch-dc' } },
          { sku: 'B', availableQuantity: 50, supplyChannel: { typeId: 'channel', id: 'ch-dc' } },
        ],
      },
    });
    const stock = await getLineStock(['A', 'B', 'A'], 'ch-branch');
    expect(inventoryGet).toHaveBeenCalledTimes(1);
    const where = inventoryGet.mock.calls[0][0].queryArgs.where as string;
    expect(where).toContain('sku in ("A","B")');
    expect(where).toContain('supplyChannel(key="mau-supply-malva-dc")');
    expect(stock.get('A')).toEqual({ branchQty: 4, masterQty: 200 });
    expect(stock.get('B')).toEqual({ branchQty: 0, masterQty: 50 });
  });
  it('an unknown sku has zero stock', async () => {
    inventoryGet.mockResolvedValue({ body: { results: [] } });
    expect((await getLineStock(['Z'], undefined)).get('Z')).toEqual({ branchQty: 0, masterQty: 0 });
  });
  it('no skus means no call', async () => {
    expect((await getLineStock([], 'ch')).size).toBe(0);
    expect(inventoryGet).not.toHaveBeenCalled();
  });
});
