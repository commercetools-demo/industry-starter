// @vitest-environment node
import type { RecurringOrder } from '@commercetools/platform-sdk';

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => Promise<unknown>) => fn }));

const state = {
  policies: [
    { id: 'p-m', key: 'malva-device-installment-12' },
    { id: 'p-24', key: 'malva-device-installment-24' },
    { id: 'p-l', key: 'malva-device-lease-24' },
  ] as { id: string; key: string }[],
  orders: [] as unknown[][],
  reads: 0,
  updates: [] as { id: string; body: unknown }[],
  customer: undefined as unknown,
};

vi.mock('@/lib/ct/client', () => ({
  getApiRoot: () => ({
    recurrencePolicies: () => ({ get: () => ({ execute: async () => ({ body: { results: state.policies } }) }) }),
    recurringOrders: () => ({
      get: () => ({
        execute: async () => {
          const results = state.orders[Math.min(state.reads, state.orders.length - 1)] ?? [];
          state.reads += 1;
          return { body: { results } };
        },
      }),
      withId: ({ ID }: { ID: string }) => ({
        post: ({ body }: { body: unknown }) => ({
          execute: async () => {
            state.updates.push({ id: ID, body });
            return { body: {} };
          },
        }),
      }),
    }),
  }),
}));
vi.mock('@/lib/ct/catalog', () => ({ getAllOffers: async () => [] }));
vi.mock('@/lib/ct/customer', () => ({ getCustomerById: async () => state.customer }));

import { applyDeviceRecurringExpiry, assertDeviceCartIntegrity, getCreditFlag, getDevicePolicyId, getDevicePolicyMap } from './devices';

const line = (policyId: string) => ({ recurrenceInfo: { recurrencePolicy: { id: policyId } } });
const order = (id: string, policyIds: string[], patch: Partial<RecurringOrder> = {}): unknown => ({
  id,
  version: 3,
  startsAt: '2026-10-07T09:30:00.000Z',
  recurringOrderState: 'Active',
  cart: { obj: { lineItems: policyIds.map(line) } },
  ...patch,
});
const noSleep = async (): Promise<void> => {};

beforeEach(() => {
  state.orders = [];
  state.reads = 0;
  state.updates = [];
  state.customer = undefined;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('device policies', () => {
  it('maps policy ids to keys and finds the id of a key', async () => {
    expect(await getDevicePolicyMap()).toEqual({ 'p-m': 'malva-device-installment-12', 'p-24': 'malva-device-installment-24', 'p-l': 'malva-device-lease-24' });
    expect(await getDevicePolicyId('malva-device-lease-24')).toBe('p-l');
    expect(await getDevicePolicyId('malva-device-installment-36')).toBeUndefined();
  });
});

describe('getCreditFlag', () => {
  it('declines only when creditApproved is false', async () => {
    state.customer = { custom: { fields: { creditApproved: false } } };
    expect(await getCreditFlag('c1')).toBe('decline');
    state.customer = { custom: { fields: { creditApproved: true } } };
    expect(await getCreditFlag('c1')).toBe('approve');
    state.customer = { custom: { fields: {} } };
    expect(await getCreditFlag('c1')).toBe('approve');
    state.customer = null;
    expect(await getCreditFlag('c1')).toBe('approve');
  });
});

describe('applyDeviceRecurringExpiry', () => {
  it('sets the expiry once on a Recurring Order that holds only device lines of one term', async () => {
    state.orders = [[order('ro-1', ['p-24', 'p-l'])]];
    const result = await applyDeviceRecurringExpiry('o-1', { sleep: noSleep });
    expect(result).toEqual({ applied: ['ro-1'], skipped: [], polls: 1 });
    expect(state.updates).toEqual([{ id: 'ro-1', body: { version: 3, actions: [{ action: 'setExpiresAt', expiresAt: '2028-09-14T09:30:00.000Z' }] } }]);
  });

  it('is idempotent: a Recurring Order that already has an expiry is left alone', async () => {
    state.orders = [[order('ro-1', ['p-24'], { expiresAt: '2028-09-14T09:30:00.000Z' })]];
    const result = await applyDeviceRecurringExpiry('o-1', { sleep: noSleep });
    expect(result.applied).toEqual([]);
    expect(result.skipped).toEqual([{ id: 'ro-1', reason: 'already-set' }]);
    expect(state.updates).toEqual([]);
  });

  it('never sets an expiry on a Recurring Order that also holds a plan (the plan would end with it)', async () => {
    state.orders = [[order('ro-1', ['p-24', 'p-monthly'])]];
    const result = await applyDeviceRecurringExpiry('o-1', { sleep: noSleep });
    expect(result.skipped).toEqual([{ id: 'ro-1', reason: 'not-only-devices' }]);
    expect(state.updates).toEqual([]);
  });

  it('never sets an expiry when the lines have different terms', async () => {
    state.orders = [[order('ro-1', ['p-m', 'p-24'])]];
    const result = await applyDeviceRecurringExpiry('o-1', { sleep: noSleep });
    expect(result.skipped).toEqual([{ id: 'ro-1', reason: 'mixed-terms' }]);
    expect(state.updates).toEqual([]);
  });

  it('skips a Recurring Order that is not active', async () => {
    state.orders = [[order('ro-1', ['p-24'], { recurringOrderState: 'Canceled' })]];
    expect((await applyDeviceRecurringExpiry('o-1', { sleep: noSleep })).skipped).toEqual([{ id: 'ro-1', reason: 'not-active' }]);
  });

  it('polls until the Recurring Orders appear (they are created in the background)', async () => {
    state.orders = [[], [], [order('ro-1', ['p-24'])]];
    const sleeps: number[] = [];
    const result = await applyDeviceRecurringExpiry('o-1', { sleep: async (ms) => void sleeps.push(ms) });
    expect(result.polls).toBe(3);
    expect(result.applied).toEqual(['ro-1']);
    expect(sleeps).toEqual([2000, 2000]);
  });

  it('gives up after 5 tries without throwing', async () => {
    state.orders = [[]];
    const sleeps: number[] = [];
    const result = await applyDeviceRecurringExpiry('o-1', { sleep: async (ms) => void sleeps.push(ms) });
    expect(result).toEqual({ applied: [], skipped: [], polls: 0 });
    expect(state.reads).toBe(5);
    expect(sleeps).toHaveLength(4);
  });
});

describe('assertDeviceCartIntegrity', () => {
  const deviceLine = (id: string, mode: string, term: number, policyId?: string) => ({
    id,
    price: policyId ? { recurrencePolicy: { id: policyId } } : {},
    ...(policyId ? { recurrenceInfo: { recurrencePolicy: { id: policyId } } } : {}),
    custom: { fields: { acquisitionMode: mode, acquisitionTermMonths: term } },
  });

  it('passes when every device line prices from the policy of its recorded mode and term', async () => {
    await expect(assertDeviceCartIntegrity({ lineItems: [deviceLine('a', 'outright', 0), deviceLine('b', 'installments', 24, 'p-24'), deviceLine('c', 'lease', 24, 'p-l')] as never })).resolves.toBeUndefined();
  });

  it('throws PRICE_NOT_FOR_TERM for a financed line whose price fell back to the one-time price', async () => {
    await expect(assertDeviceCartIntegrity({ lineItems: [deviceLine('b', 'installments', 24)] as never })).rejects.toMatchObject({ code: 'PRICE_NOT_FOR_TERM', lineItemId: 'b' });
  });
});
