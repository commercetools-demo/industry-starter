import { ApiError } from '@/lib/api-error';
import { RECURRENCE_POLICY_TTL_S } from '@/lib/config/cache';

const policyGet = vi.fn();
const withKey = vi.fn((_args: { key: string }) => ({ get: () => ({ execute: policyGet }) }));
const unstableCache = vi.fn<(fn: () => Promise<unknown>, keys: string[], options: { revalidate?: number }) => () => Promise<unknown>>((fn) => fn);

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>, keys: string[], options: { revalidate?: number }) => unstableCache(fn, keys, options) }));
vi.mock('./client', () => ({ getApiRoot: () => ({ recurrencePolicies: () => ({ withKey }) }) }));
vi.mock('./timeout', () => ({ withTimeout: (promise: Promise<unknown>) => promise }));

import { assertRecurringPrice, getMonthlyPolicy, recurrenceInfoDraft } from './recurring';

const policy = { id: 'pol-1', key: 'malva-monthly', version: 3 };

beforeEach(() => {
  policyGet.mockReset();
  withKey.mockClear();
  unstableCache.mockClear();
});

describe('recurrence policy', () => {
  it('reads malva-monthly by key and caches it for the policy TTL', async () => {
    policyGet.mockResolvedValue({ body: { id: 'pol-1', key: 'malva-monthly', version: 3, schedule: { type: 'standard', value: 1, intervalUnit: 'Months' } } });
    await expect(getMonthlyPolicy()).resolves.toEqual(policy);
    expect(withKey).toHaveBeenCalledWith({ key: 'malva-monthly' });
    expect(unstableCache.mock.calls[0]?.[2].revalidate).toBe(RECURRENCE_POLICY_TTL_S);
    expect(RECURRENCE_POLICY_TTL_S).toBe(3600);
  });
  it('a 404 throws RECURRENCE_POLICY_MISSING', async () => {
    policyGet.mockRejectedValue({ statusCode: 404 });
    const err = await getMonthlyPolicy().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).details?.reason).toBe('RECURRENCE_POLICY_MISSING');
  });
  it('another upstream failure is rethrown unchanged', async () => {
    policyGet.mockRejectedValue({ statusCode: 503 });
    await expect(getMonthlyPolicy()).rejects.toEqual({ statusCode: 503 });
  });
});

describe('recurrenceInfoDraft and assertRecurringPrice', () => {
  it('the draft has the exact shape', () => {
    expect(recurrenceInfoDraft({ policyKey: 'malva-monthly', priceSelectionMode: 'Fixed' })).toEqual({
      recurrencePolicy: { typeId: 'recurrence-policy', key: 'malva-monthly' },
      priceSelectionMode: 'Fixed',
    });
  });
  it('throws RECURRING_PRICE_MISSING when the price has no policy', () => {
    try {
      assertRecurringPrice({ price: {} }, policy, 'MLV-CBL-500-24M');
      expect.unreachable();
    } catch (err) {
      expect((err as ApiError).details).toEqual({ reason: 'RECURRING_PRICE_MISSING', sku: 'MLV-CBL-500-24M' });
    }
    expect(() => assertRecurringPrice({}, policy, 'X')).toThrow(ApiError);
  });
  it('throws when the price is tied to another policy', () => {
    expect(() => assertRecurringPrice({ price: { recurrencePolicy: { id: 'other' } } }, policy, 'X')).toThrow(ApiError);
  });
  it('passes when the ids match', () => {
    expect(() => assertRecurringPrice({ price: { recurrencePolicy: { id: 'pol-1' } } }, policy, 'X')).not.toThrow();
  });
});
