/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { CartLineRef, HeldService, Offer } from '@/lib/types';
import * as fx from './__fixtures__/offers';
import { missingAddonKinds, negatedLines, requiredOfferReasons, revalidateNegations, revalidateRequiredAddonKinds, revalidateRequiredOffers } from './dependencies';

const line = (lineItemId: string, offer: Offer, parentLineItemId?: string): CartLineRef => ({ lineItemId, offerKey: offer.key, quantity: 1, ...(parentLineItemId ? { parentLineItemId } : {}) });
const held = (offer: Offer): HeldService => ({ offerKey: offer.key, offerName: offer.name, source: 'order', reference: 'ORD-1' });

const stick = fx.routerAc1200;
const needsStick: Offer = { ...fx.secure, key: 'malva-offer-needs-stick', name: 'Needs stick', requiresOffers: [stick.key] };
const byKey = (...offers: Offer[]): Record<string, Offer> => Object.fromEntries(offers.map((offer) => [offer.key, offer]));

describe('required offers', () => {
  const offers = byKey(needsStick, stick, fx.cable500);

  it('refuses while the required offer is missing, naming it', () => {
    const { reasons, missing } = requiredOfferReasons(needsStick, [line('L1', fx.cable500)], [], offers);
    expect(reasons).toMatchObject([{ code: 'REQUIRED_OFFER_MISSING', params: { requiredName: stick.name }, offerKeys: [needsStick.key, stick.key] }]);
    expect(missing[0]?.offer?.key).toBe(stick.key);
  });

  it('accepts when it is in the cart or held', () => {
    expect(requiredOfferReasons(needsStick, [line('L2', stick)], [], offers).reasons).toEqual([]);
    expect(requiredOfferReasons(needsStick, [], [held(stick)], offers).reasons).toEqual([]);
  });

  it('an unknown reference fails closed and names the reference', () => {
    const ghost = { ...needsStick, requiresOffers: ['malva-offer-ghost'] };
    expect(requiredOfferReasons(ghost, [], [], byKey(ghost)).reasons[0]?.params.requiredName).toBe('malva-offer-ghost');
  });

  it('removing the required offer later makes the dependent line a blocking issue on read', () => {
    const ok = [line('L1', needsStick), line('L2', stick)];
    expect(revalidateRequiredOffers(ok, { held: [] }, offers)).toEqual([]);
    expect(revalidateRequiredOffers([line('L1', needsStick)], { held: [] }, offers)).toMatchObject([{ lineItemId: 'L1', blocking: true, resolution: 'remove' }]);
    expect(revalidateRequiredOffers([line('L1', needsStick)], { held: [held(stick)] }, offers)).toEqual([]);
  });
});

describe('required add-on kinds', () => {
  const plan: Offer = { ...fx.cable500, facts: { ...(fx.cable500.facts as object), requiredAddonKinds: ['installation'] } as Offer['facts'], includedOffers: [] };
  const diy: Offer = { ...fx.secure, key: 'malva-offer-diy', name: 'DIY', facts: { ...(fx.secure.facts as object), addonKind: 'installation' } as Offer['facts'] };
  const pro: Offer = { ...diy, key: 'malva-offer-pro', name: 'Professional' };
  const offers = byKey(plan, diy, pro);

  it('names the missing kind and blocks with a choose link', () => {
    expect(revalidateRequiredAddonKinds([line('P', plan)], offers)).toMatchObject([{ lineItemId: 'P', resolution: 'choose-equipment', reasons: [{ code: 'REQUIRED_ADDON_KIND_MISSING', params: { kind: 'installation' } }] }]);
  });

  it('one of the kind is enough, and replacing it with another stays satisfied', () => {
    expect(revalidateRequiredAddonKinds([line('P', plan), line('A', diy, 'P')], offers)).toEqual([]);
    expect(revalidateRequiredAddonKinds([line('P', plan), line('A', pro, 'P')], offers)).toEqual([]);
  });

  it('a line attached to another plan does not count', () => {
    expect(missingAddonKinds(plan, line('P', plan), [line('P', plan), line('A', diy, 'OTHER')], offers)).toEqual(['installation']);
  });

  it('an included offer of the kind satisfies the requirement', () => {
    const including = { ...plan, includedOffers: [diy.key] };
    expect(revalidateRequiredAddonKinds([line('P', including)], byKey(including, diy))).toEqual([]);
  });
});

describe('negated offers', () => {
  const diy: Offer = { ...fx.secure, key: 'malva-offer-diy', name: 'DIY' };
  const pro: Offer = { ...fx.secure, key: 'malva-offer-pro', name: 'Professional', negatesOffers: [diy.key] };
  const offers = byKey(diy, pro);

  it('finds the lines the candidate replaces, and reports the reverse as declared by the other side', () => {
    expect(negatedLines(pro, [line('A', diy)], offers)).toMatchObject([{ declaredBy: 'candidate' }]);
    expect(negatedLines(diy, [line('B', pro)], offers)).toMatchObject([{ declaredBy: 'other' }]);
    expect(negatedLines(pro, [line('B', pro)], offers)).toEqual([]);
  });

  it('on read nothing is removed: a catalog change that leaves both is a blocking issue on the later line', () => {
    expect(revalidateNegations([line('A', diy), line('B', pro)], offers)).toMatchObject([{ lineItemId: 'B', blocking: true, resolution: 'replace', reasons: [{ code: 'NEGATED_OFFER_CONFLICT' }] }]);
    expect(revalidateNegations([line('A', pro)], offers)).toEqual([]);
  });
});
