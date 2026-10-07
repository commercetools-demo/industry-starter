import type { Cart as CtCart } from '@commercetools/platform-sdk';
import { mapOrder } from '@/lib/mappers/order';
import { orderA, orderB } from '@/test/fixtures/orders';
import { planReorder } from './reorder';

const line = (id: string, sku: string, options: { recurring?: boolean; parent?: string } = {}) => ({
  id,
  variant: { sku },
  ...(options.recurring === false ? {} : { recurrenceInfo: { priceSelectionMode: 'Fixed' } }),
  custom: { fields: { ...(options.parent ? { parentLineItemId: options.parent } : {}) } },
});
const replica = (lineItems: unknown[], extra: Record<string, unknown> = {}): CtCart =>
  ({ id: 'new-cart', version: 1, lineItems, customLineItems: [], custom: { fields: {} }, ...extra }) as unknown as CtCart;

const A = mapOrder(orderA(), 'en-US'); // a1 cable (sku MLV-CBL-500-24M), a2 Apple TV+ child of a1
const B = mapOrder(orderB(), 'en-US');

describe('planReorder', () => {
  it('a cart that has every line needs no removal; the stale parent id is pointed at the new parent line', () => {
    const plan = planReorder(A, replica([line('n1', 'MLV-CBL-500-24M'), line('n2', 'MLV-ADD-APPLETV-MTH', { parent: 'a1' })]));
    expect(plan.unavailable).toEqual([]);
    expect(plan.actions).toEqual([{ action: 'setLineItemCustomField', lineItemId: 'n2', name: 'parentLineItemId', value: 'n1' }]);
  });

  it('a line missing from the new cart is reported as not available, and so are the add-ons that belonged to it', () => {
    const plan = planReorder(A, replica([line('n2', 'MLV-ADD-APPLETV-MTH', { parent: 'a1' })]));
    expect(plan.unavailable).toEqual([
      { sku: 'MLV-CBL-500-24M', name: 'Cable 500', reason: 'not-available' },
      { sku: 'MLV-ADD-APPLETV-MTH', name: 'Apple TV+', reason: 'not-available' },
    ]);
    expect(plan.actions).toContainEqual({ action: 'removeLineItem', lineItemId: 'n2' });
  });

  it('an add-on that is gone is reported and the plan stays', () => {
    const plan = planReorder(A, replica([line('n1', 'MLV-CBL-500-24M')]));
    expect(plan.unavailable).toEqual([{ sku: 'MLV-ADD-APPLETV-MTH', name: 'Apple TV+', reason: 'not-available' }]);
    expect(plan.actions).toEqual([]);
  });

  it('a recurring line that lost its recurrence is removed and reported', () => {
    const plan = planReorder(B, replica([line('n1', 'MLV-PHN-UNL-M2M'), line('n2', 'MLV-ADD-SPOTIFY-MTH', { recurring: false, parent: 'b1' })]));
    expect(plan.unavailable).toEqual([{ sku: 'MLV-ADD-SPOTIFY-MTH', name: 'Spotify', reason: 'recurrence-lost' }]);
    expect(plan.actions).toContainEqual({ action: 'removeLineItem', lineItemId: 'n2' });
    expect(plan.actions).not.toContainEqual(expect.objectContaining({ lineItemId: 'n1', action: 'removeLineItem' }));
  });

  it('removes and reports a line that Replicate kept although its product is no longer sold', () => {
    const plan = planReorder(A, replica([line('n1', 'MLV-CBL-500-24M'), line('n2', 'MLV-ADD-APPLETV-MTH', { parent: 'a1' })]), new Set(['MLV-CBL-500-24M']));
    expect(plan.unavailable).toEqual([{ sku: 'MLV-ADD-APPLETV-MTH', name: 'Apple TV+', reason: 'not-available' }]);
    expect(plan.actions).toEqual([{ action: 'removeLineItem', lineItemId: 'n2' }]);
  });

  it('with no catalog check (null) a present line is kept', () => {
    expect(planReorder(A, replica([line('n1', 'MLV-CBL-500-24M'), line('n2', 'MLV-ADD-APPLETV-MTH', { parent: 'n1' })]), null).unavailable).toEqual([]);
  });

  it('clears the custom fields that describe the old order and nothing else', () => {
    const plan = planReorder(A, replica([line('n1', 'MLV-CBL-500-24M'), line('n2', 'MLV-ADD-APPLETV-MTH', { parent: 'n1' })], { custom: { fields: { serviceStartDate: '2026-03-12', priceSchedule: '{}', labelSnapshot: '{}', postalCode: '10001' } } }));
    expect(plan.actions).toEqual([
      { action: 'setCustomField', name: 'serviceStartDate' },
      { action: 'setCustomField', name: 'priceSchedule' },
      { action: 'setCustomField', name: 'labelSnapshot' },
    ]);
  });

  it('removes the activation fee of a plan that could not be reused', () => {
    const plan = planReorder(A, replica([], { customLineItems: [{ id: 'fee1', slug: 'activation-fee:malva-offer-cable-500' }, { id: 'fee2', slug: 'activation-fee:other' }] }));
    expect(plan.actions).toContainEqual({ action: 'removeCustomLineItem', customLineItemId: 'fee1' });
    expect(plan.actions).not.toContainEqual({ action: 'removeCustomLineItem', customLineItemId: 'fee2' });
  });
});
