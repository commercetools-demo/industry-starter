import * as fx from '@/lib/offers/__fixtures__/offers';
import { deriveHoldings } from './holdings';

const byKey = fx.offersByKey();
const order = (orderNumber: string, offerKeys: string[], orderState = 'Confirmed') => ({ orderNumber, orderState, offerKeys });
const recurring = (id: string, offerKeys: string[], state = 'Active') => ({ id, state, offerKeys });

describe('deriveHoldings', () => {
  it('Conflict with a service already held: held services come from non-cancelled orders and active recurring orders', () => {
    const held = deriveHoldings(
      [order('MLV-1', ['malva-offer-cable-500']), order('MLV-2', ['malva-offer-phone-unlimited'], 'Cancelled')],
      [recurring('RO-1', ['malva-offer-wireless-5g']), recurring('RO-2', ['malva-offer-phone-plus'], 'Canceled')],
      byKey,
    );
    expect(held).toEqual([
      { offerKey: 'malva-offer-cable-500', offerName: 'Cable 500', source: 'order', reference: 'MLV-1' },
      { offerKey: 'malva-offer-wireless-5g', offerName: 'Air 5G', source: 'recurring-order', reference: 'RO-1' },
    ]);
  });

  it('keeps Paused recurring orders and ignores Expired and Canceled ones', () => {
    const held = deriveHoldings([], [recurring('A', ['malva-offer-cable-100'], 'Paused'), recurring('B', ['malva-offer-cable-500'], 'Expired'), recurring('C', ['malva-offer-cable-gig'], 'Canceled')], byKey);
    expect(held.map((entry) => entry.offerKey)).toEqual(['malva-offer-cable-100']);
  });

  it('keeps only base packages and bundles (add-ons, equipment and devices hold no service)', () => {
    const bundle = { ...fx.cable500, key: 'malva-offer-bundle-x', kind: 'bundle' as const, name: 'Bundle X' };
    const held = deriveHoldings(
      [order('MLV-1', ['malva-offer-spotify', 'malva-offer-router-ac1200', 'malva-offer-cable-100', 'malva-offer-bundle-x'])],
      [],
      { ...byKey, [bundle.key]: bundle },
    );
    expect(held.map((entry) => entry.offerKey)).toEqual(['malva-offer-bundle-x', 'malva-offer-cable-100']);
  });

  it('de-duplicates by offer key and prefers the recurring order', () => {
    const held = deriveHoldings([order('MLV-1', ['malva-offer-cable-500']), order('MLV-9', ['malva-offer-cable-500'])], [recurring('RO-1', ['malva-offer-cable-500'])], byKey);
    expect(held).toEqual([{ offerKey: 'malva-offer-cable-500', offerName: 'Cable 500', source: 'recurring-order', reference: 'RO-1' }]);
    const onlyOrders = deriveHoldings([order('MLV-1', ['malva-offer-cable-500']), order('MLV-9', ['malva-offer-cable-500'])], [], byKey);
    expect(onlyOrders).toEqual([{ offerKey: 'malva-offer-cable-500', offerName: 'Cable 500', source: 'order', reference: 'MLV-1' }]);
  });

  it('ignores offer keys that are not in the catalog and sorts by offer key', () => {
    const held = deriveHoldings([order('MLV-1', ['malva-offer-retired', 'malva-offer-phone-unlimited', 'malva-offer-cable-100'])], [], byKey);
    expect(held.map((entry) => entry.offerKey)).toEqual(['malva-offer-cable-100', 'malva-offer-phone-unlimited']);
  });

  it('holds nothing for no orders', () => {
    expect(deriveHoldings([], [], byKey)).toEqual([]);
  });
});
