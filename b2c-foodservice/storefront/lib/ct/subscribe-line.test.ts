// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ getEnv: () => ({ SESSION_SECRET: 'a'.repeat(40) }) }));
vi.mock('@/lib/ct/client', () => ({ apiRoot: {} }));

import { groupLines } from '@/lib/cart/plan';
import { buildAddLineAction } from '@/lib/ct/cart';
import { viewLine } from '@/test/cart';

describe('subscribe lines in the add action', () => {
  const policy = { policyId: 'rp-1m' };

  it('Subscribe line is added with priceSelectionMode Fixed', () => {
    const action = buildAddLineAction({ sku: 'POD-10', quantity: 2, fulfilment: 'subscribe', recurrencePolicyKey: 'mcf-every-month' }, policy);
    expect(action.recurrenceInfo).toEqual({ recurrencePolicy: { typeId: 'recurrence-policy', id: 'rp-1m' }, priceSelectionMode: 'Fixed' });
  });

  it('One-time line omits recurrenceInfo', () => {
    const action = buildAddLineAction({ sku: 'POD-10', quantity: 1, fulfilment: 'delivery' });
    expect(Object.keys(action)).not.toContain('recurrenceInfo');
  });

  it('Subscribe line never gets a supplyChannel', () => {
    const action = buildAddLineAction({ sku: 'POD-10', quantity: 1, fulfilment: 'subscribe', recurrencePolicyKey: 'mcf-every-month' }, policy);
    expect(Object.keys(action)).not.toContain('supplyChannel');
  });

  it('subscribe and one-time lines of one SKU stay separate lines', () => {
    const one = viewLine({ id: 'a', sku: 'POD-10', fulfilment: 'delivery' });
    const two = viewLine({ id: 'b', sku: 'POD-10', fulfilment: 'subscribe', recurrence: { policyId: 'rp', schedule: { unit: 'Months', value: 1 } } });
    const groups = groupLines([one, two]);
    expect(groups.map((g) => [g.kind, g.lineIds])).toEqual([['delivery', ['a']], ['subscribe', ['b']]]);
  });
});
