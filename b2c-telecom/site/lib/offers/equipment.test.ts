import type { Offer } from '@/lib/types';
import * as fx from './__fixtures__/offers';
import { compatibleEquipmentFor, defaultEquipment, includedEquipmentKinds, missingRequiredEquipment } from './equipment';

const equipmentOffers = fx.ALL_OFFERS.filter((offer) => offer.kind === 'equipment');
const internetNeedingRouter = fx.plan({ id: 'cable-gig-router', name: 'Cable Gig R', family: 'internet', technology: 'cable', mbps: 1000, required: ['router'] });

describe('required equipment (D-025)', () => {
  it('compatibleEquipmentFor keeps allowed equipment only (not too slow, not included, not another technology)', () => {
    expect(compatibleEquipmentFor(fx.cableGig, equipmentOffers).map((offer) => offer.key)).toEqual(['malva-offer-router-ax3000', 'malva-offer-mesh-be9300']);
    expect(compatibleEquipmentFor(fx.phoneUnlimited, equipmentOffers)).toEqual([]);
  });

  it('picks the cheapest compatible equipment of the required kind, as a rental variant', () => {
    const result = defaultEquipment(internetNeedingRouter, equipmentOffers);
    expect(result.selections).toEqual([{ kind: 'router', offerKey: 'malva-offer-router-ax3000', variantSku: 'MLV-EQP-ROUTER-AX3000-RENT', mode: 'rental' }]);
    expect(result.unfulfillable).toEqual([]);
  });

  it('breaks a price tie by offer key', () => {
    const twin = fx.equipment('router-aaa', 'Twin', 'router', 2000, ['cable'], { rent: 800 });
    const result = defaultEquipment(internetNeedingRouter, [...equipmentOffers, twin]);
    expect(result.selections[0]?.offerKey).toBe('malva-offer-router-aaa');
  });

  it('prefers a rental offer over a cheaper purchase-only offer', () => {
    const cheapBuy = fx.equipment('router-buy', 'Buy only', 'router', 2000, ['cable'], { buy: 1000 });
    expect(defaultEquipment(internetNeedingRouter, [cheapBuy, fx.routerAx3000]).selections[0]?.offerKey).toBe('malva-offer-router-ax3000');
  });

  it('falls back to the cheapest purchase variant when no rental exists', () => {
    const buyA = fx.equipment('router-a', 'A', 'router', 2000, ['cable'], { buy: 9000 });
    const buyB = fx.equipment('router-b', 'B', 'router', 2000, ['cable'], { buy: 5000 });
    expect(defaultEquipment(internetNeedingRouter, [buyA, buyB]).selections).toEqual([
      { kind: 'router', offerKey: 'malva-offer-router-b', variantSku: 'MLV-EQP-ROUTER-B-BUY', mode: 'purchase' },
    ]);
  });

  it('a kind nothing can fulfil lands in unfulfillable', () => {
    const needsExtender = fx.plan({ id: 'x', name: 'X', family: 'internet', technology: 'cable', mbps: 100, required: ['router', 'extender'] });
    const result = defaultEquipment(needsExtender, equipmentOffers);
    expect(result.selections.map((selection) => selection.kind)).toEqual(['router']);
    expect(result.unfulfillable).toEqual(['extender']);
  });

  it('an equipment offer without any price is never chosen', () => {
    const unpriced: Offer = { ...fx.equipment('router-free', 'Free', 'router', 2000, ['cable'], {}), variants: [] };
    expect(defaultEquipment(internetNeedingRouter, [unpriced]).unfulfillable).toEqual(['router']);
  });

  it('equipment the plan includes satisfies the kind with no line (the seeded modem and gateway)', () => {
    expect(includedEquipmentKinds(fx.cable500, equipmentOffers)).toEqual(['modem']);
    expect(defaultEquipment(fx.cable500, equipmentOffers)).toEqual({ selections: [], unfulfillable: [], includedKinds: ['modem'] });
    expect(defaultEquipment(fx.wireless5g, equipmentOffers).includedKinds).toEqual(['gateway']);
  });

  it('missingRequiredEquipment lists required kinds with no attached item and no included equipment', () => {
    expect(missingRequiredEquipment(internetNeedingRouter, [], equipmentOffers)).toEqual(['router']);
    expect(missingRequiredEquipment(internetNeedingRouter, [fx.routerAx3000], equipmentOffers)).toEqual([]);
    expect(missingRequiredEquipment(fx.cable500, [], equipmentOffers)).toEqual([]);
    expect(missingRequiredEquipment(fx.cable500, [])).toEqual(['modem']);
    expect(missingRequiredEquipment(fx.phoneUnlimited, [], equipmentOffers)).toEqual([]);
  });
});
