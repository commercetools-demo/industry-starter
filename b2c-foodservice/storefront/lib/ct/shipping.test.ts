// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { execute, get } = vi.hoisted(() => {
  const execute = vi.fn();
  return { execute, get: vi.fn(() => ({ execute })) };
});
vi.mock('@/lib/ct/client', () => ({ apiRoot: { shippingMethods: () => ({ matchingLocation: () => ({ get }) }) } }));
// Pass-through: the real cache is exercised by Next, not by unit tests.
vi.mock('@/lib/ct/public-cache', () => ({ cachedPublic: (_k: string, _p: string[], fn: unknown) => fn }));

import { getFreeShippingThreshold } from '@/lib/ct/shipping';

const method = (key: string, rates: Array<{ currency: string; freeAbove?: number; isMatching?: boolean }>) => ({
  key,
  zoneRates: [
    {
      shippingRates: rates.map((r) => ({
        price: { centAmount: 695, currencyCode: r.currency },
        ...(r.freeAbove !== undefined ? { freeAbove: { centAmount: r.freeAbove, currencyCode: r.currency } } : {}),
        ...(r.isMatching !== undefined ? { isMatching: r.isMatching } : {}),
      })),
    },
  ],
});

beforeEach(() => {
  execute.mockReset();
  get.mockClear();
});

describe('free shipping threshold', () => {
  it('Threshold changes: the figure follows the rate with no code change', async () => {
    execute.mockResolvedValueOnce({ body: { results: [method('mcf-ship-standard', [{ currency: 'USD', freeAbove: 7500 }])] } });
    expect(await getFreeShippingThreshold('US', 'USD')).toEqual({ centAmount: 7500, currencyCode: 'USD' });
    execute.mockResolvedValueOnce({ body: { results: [method('mcf-ship-standard', [{ currency: 'USD', freeAbove: 8000 }])] } });
    expect(await getFreeShippingThreshold('US', 'USD')).toEqual({ centAmount: 8000, currencyCode: 'USD' });
  });

  it('no freeAbove returns null', async () => {
    execute.mockResolvedValue({ body: { results: [method('mcf-ship-standard', [{ currency: 'USD' }])] } });
    expect(await getFreeShippingThreshold('US', 'USD')).toBeNull();
  });

  it('threshold read per market', async () => {
    execute.mockResolvedValueOnce({ body: { results: [method('mcf-ship-standard', [{ currency: 'USD', freeAbove: 7500 }])] } });
    execute.mockResolvedValueOnce({ body: { results: [method('mcf-ship-standard', [{ currency: 'CAD', freeAbove: 9900 }])] } });
    expect((await getFreeShippingThreshold('US', 'USD'))?.centAmount).toBe(7500);
    expect(await getFreeShippingThreshold('CA', 'CAD')).toEqual({ centAmount: 9900, currencyCode: 'CAD' });
    expect(get).toHaveBeenLastCalledWith({ queryArgs: { country: 'CA', currency: 'CAD' } });
  });

  it('ignores other methods, non-matching rates and other currencies', async () => {
    execute.mockResolvedValue({
      body: {
        results: [
          method('mcf-ship-express', [{ currency: 'USD', freeAbove: 1 }]),
          method('mcf-ship-standard', [
            { currency: 'USD', freeAbove: 111, isMatching: false },
            { currency: 'CAD', freeAbove: 222 },
            { currency: 'USD', freeAbove: 7500, isMatching: true },
          ]),
        ],
      },
    });
    expect((await getFreeShippingThreshold('US', 'USD'))?.centAmount).toBe(7500);
  });
});
