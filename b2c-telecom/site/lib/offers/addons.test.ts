import type { CartLineRef } from '@/lib/types';
import * as fx from './__fixtures__/offers';
import { attachmentFields, dependentQuantity, dependentsOf, findOrphans, planLinesOf, removalPlan } from './addons';

const line = (lineItemId: string, offerKey: string, parentLineItemId?: string, quantity = 1): CartLineRef => ({ lineItemId, offerKey, parentLineItemId, quantity });
const cart: CartLineRef[] = [
  line('L1', 'malva-offer-cable-500'),
  line('L2', 'malva-offer-spotify', 'L1'),
  line('L3', 'malva-offer-router-ax3000', 'L1'),
  line('L4', 'malva-offer-phone-unlimited', undefined, 2),
  line('L5', 'malva-offer-secure', 'L4'),
];

describe('parent link (D-026)', () => {
  it('planLinesOf returns base-package and bundle lines only, in cart order', () => {
    expect(planLinesOf(cart, fx.offersByKey()).map((l) => l.lineItemId)).toEqual(['L1', 'L4']);
  });

  it('dependentsOf lists the lines pointing at a parent', () => {
    expect(dependentsOf(cart, 'L1').map((l) => l.lineItemId)).toEqual(['L2', 'L3']);
    expect(dependentsOf(cart, 'L2')).toEqual([]);
  });

  it('Add ons follow their parent: removalPlan of the plan line returns the plan and every dependent, requiresConfirmation true', () => {
    expect(removalPlan(cart, 'L1')).toEqual({ removeIds: ['L1', 'L2', 'L3'], dependentCount: 2, requiresConfirmation: true });
  });

  it('removing an add-on removes only itself, and a plan without dependents needs no confirmation', () => {
    expect(removalPlan(cart, 'L2')).toEqual({ removeIds: ['L2'], dependentCount: 0, requiresConfirmation: false });
    expect(removalPlan([line('P', 'malva-offer-cable-100')], 'P').requiresConfirmation).toBe(false);
  });

  it('findOrphans reports dependents whose parent line is gone', () => {
    expect(findOrphans(cart)).toEqual([]);
    const withoutParent = cart.filter((l) => l.lineItemId !== 'L4');
    expect(findOrphans(withoutParent).map((l) => l.lineItemId)).toEqual(['L5']);
  });

  it('the dependent quantity mirrors the parent quantity', () => {
    expect(dependentQuantity(3)).toBe(3);
  });

  it('attachmentFields names the offer and the parent, and throws unless the verdict is allowed with a parent', () => {
    expect(attachmentFields({ status: 'allowed', reasons: [], parentLineItemId: 'L1' }, fx.spotify)).toEqual({ offerKey: 'malva-offer-spotify', parentLineItemId: 'L1' });
    expect(() => attachmentFields({ status: 'unavailable', reasons: [] }, fx.spotify)).toThrow();
    expect(() => attachmentFields({ status: 'included', reasons: [], parentLineItemId: 'L1' }, fx.spotify)).toThrow();
    expect(() => attachmentFields({ status: 'allowed', reasons: [] }, fx.spotify)).toThrow();
  });
});
