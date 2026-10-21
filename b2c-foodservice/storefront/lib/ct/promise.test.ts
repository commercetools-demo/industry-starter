// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOSED_ALL_WEEK } from '@/lib/hours';
import type { Store } from '@/lib/types';

const m = vi.hoisted(() => ({ threshold: vi.fn(), stores: vi.fn() }));
vi.mock('@/lib/ct/shipping', () => ({ getFreeShippingThreshold: m.threshold }));
vi.mock('@/lib/ct/channels', () => ({ getStoresForCountry: m.stores }));

import { getPromiseFigures } from '@/lib/ct/promise';

const store = (key: string, collectionMinutes: number): Store => ({
  id: key, key, name: key, addressLine: '', city: 'New York', postalCode: '', country: 'US',
  hours: CLOSED_ALL_WEEK, timeZone: 'America/New_York', collectionMinutes,
});
const US = { country: 'US', currency: 'USD', locale: 'en-US' };
const CA = { country: 'CA', currency: 'CAD', locale: 'en-CA' };

beforeEach(() => {
  m.threshold.mockReset().mockResolvedValue({ centAmount: 7500, currencyCode: 'USD' });
  m.stores.mockReset().mockResolvedValue([store('a', 20), store('b', 10), store('c', 30)]);
});

describe('getPromiseFigures', () => {
  it('collection minutes from the chosen store else minimum else hidden', async () => {
    expect((await getPromiseFigures(US, 'a')).collectionMinutes).toBe(20);
    expect((await getPromiseFigures(US)).collectionMinutes).toBe(10);
    expect((await getPromiseFigures(US, 'unknown')).collectionMinutes).toBe(10);
    m.stores.mockResolvedValue([]);
    expect((await getPromiseFigures(US)).collectionMinutes).toBeNull();
  });

  it('Canada promise bar has no collection clause', async () => {
    m.threshold.mockResolvedValue({ centAmount: 9900, currencyCode: 'CAD' });
    const f = await getPromiseFigures(CA, 'a');
    expect(f.collectionMinutes).toBeNull();
    expect(f.freeShippingThreshold).toEqual({ centAmount: 9900, currencyCode: 'CAD' });
    expect(m.stores).not.toHaveBeenCalled();
  });

  it('no freeAbove hides the clause and a failure never throws', async () => {
    m.threshold.mockResolvedValue(null);
    expect((await getPromiseFigures(US)).freeShippingThreshold).toBeNull();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    m.threshold.mockRejectedValue({ statusCode: 503 });
    expect((await getPromiseFigures(US)).freeShippingThreshold).toBeNull();
    spy.mockRestore();
  });

  it('carries the return days from the shop config', async () => {
    expect((await getPromiseFigures(US)).returnDays).toBe(30);
  });
});
