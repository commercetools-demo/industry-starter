import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('@/lib/ct/client', () => ({ apiRoot: { inventory: () => ({ get: (a: unknown) => ({ execute: () => get(a) }) }) } }));

import { assessShelfLife, getSupplyBySku, promiseStillMet, SHORT_DATED_CHANNEL_KEY, shortDatedPriceOf } from '@/lib/ct/shelf-life';

const TODAY = '2026-10-08';
const SHORT = { centAmount: 700, currencyCode: 'USD', fractionDigits: 2 };

beforeEach(() => get.mockReset());

describe('expiry-dated-supply: Remaining life shown before commitment', () => {
  it('reads availability and the expiry date of the inventory entry without a supply channel', async () => {
    get.mockResolvedValue({
      body: {
        results: [
          { sku: 'MED-famotidine-20-mg', availableQuantity: 600, custom: { fields: { expiryDate: '2026-11-15' } } },
          { sku: 'MED-ibuprofen-400-mg', availableQuantity: 600 },
        ],
      },
    });
    const supply = await getSupplyBySku(['MED-famotidine-20-mg', 'MED-ibuprofen-400-mg', 'MED-famotidine-20-mg']);
    expect(supply.get('MED-famotidine-20-mg')).toEqual({ sku: 'MED-famotidine-20-mg', available: 600, expiryDate: '2026-11-15' });
    expect(supply.get('MED-ibuprofen-400-mg')).toEqual({ sku: 'MED-ibuprofen-400-mg', available: 600 });
    const where = (get.mock.calls[0][0] as { queryArgs: { where: string } }).queryArgs.where;
    expect(where).toBe('sku in ("MED-famotidine-20-mg", "MED-ibuprofen-400-mg") and supplyChannel is not defined');
  });

  it('a SKU with characters outside the SKU alphabet never reaches the predicate', async () => {
    expect((await getSupplyBySku(['a" or sku is defined or "b'])).size).toBe(0);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('expiry-dated-supply: Undated goods unaffected', () => {
  it('no expiry date: normal stock, nothing shown or recorded', () => {
    expect(assessShelfLife({ minRemainingShelfLifeDays: 90, today: TODAY })).toEqual({ status: 'ok' });
  });
});

describe('expiry-dated-supply: Account minimum excludes unsuitable stock', () => {
  it('stock below the promise and without a short-dated price is excluded, with the reason', () => {
    expect(assessShelfLife({ minRemainingShelfLifeDays: 90, expiryDate: '2026-11-15', today: TODAY })).toEqual({
      status: 'excluded',
      refusal: { reason: 'SHELF_LIFE', remaining: 0, expiryDate: '2026-11-15', daysLeft: 38 },
    });
  });

  it('stock past its date is excluded even when a short-dated price exists', () => {
    expect(assessShelfLife({ minRemainingShelfLifeDays: 30, expiryDate: '2026-10-01', today: TODAY, shortDatedPrice: SHORT }).status).toBe('excluded');
  });
});

describe('expiry-dated-supply: Short dated stock offered on its own terms', () => {
  it('is presented as short-dated with its actual expiry and its own price', () => {
    expect(assessShelfLife({ minRemainingShelfLifeDays: 90, expiryDate: '2026-11-15', today: TODAY, shortDatedPrice: SHORT })).toEqual({
      status: 'short-dated',
      expiryDate: '2026-11-15',
      daysLeft: 38,
      price: SHORT,
    });
  });

  it('stock that meets the promise is normal stock at the normal price', () => {
    expect(assessShelfLife({ minRemainingShelfLifeDays: 30, expiryDate: '2026-11-15', today: TODAY, shortDatedPrice: SHORT })).toEqual({ status: 'ok' });
  });

  it('finds the short-dated price on its price channel (expanded) in the visitor currency', () => {
    const prices = [
      { value: { centAmount: 980, currencyCode: 'USD', fractionDigits: 2 } },
      { value: { centAmount: 700, currencyCode: 'USD', fractionDigits: 2 }, channel: { obj: { key: SHORT_DATED_CHANNEL_KEY } } },
      { value: { centAmount: 600, currencyCode: 'EUR', fractionDigits: 2 }, channel: { obj: { key: SHORT_DATED_CHANNEL_KEY } } },
    ];
    expect(shortDatedPriceOf(prices, 'USD')).toEqual(SHORT);
    expect(shortDatedPriceOf(prices.slice(0, 1), 'USD')).toBeNull();
    expect(shortDatedPriceOf(undefined, 'USD')).toBeNull();
  });
});

describe('expiry-dated-supply: Stock ages before dispatch', () => {
  it('a promise that was met at order time is flagged at picking when the stock has aged', () => {
    const base = { minRemainingShelfLifeDays: 30, expiryDate: '2026-11-15' };
    expect(promiseStillMet({ ...base, today: TODAY })).toBeNull();
    expect(promiseStillMet({ ...base, today: '2026-10-20', leadDays: 2 })).toMatchObject({ reason: 'SHELF_LIFE', expiryDate: '2026-11-15' });
  });

  it('undated goods never raise it', () => {
    expect(promiseStillMet({ minRemainingShelfLifeDays: 90, today: '2030-01-01' })).toBeNull();
  });
});
