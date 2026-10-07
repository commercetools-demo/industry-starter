import { describe, expect, it } from 'vitest';
import { COPIED_FROM_ANCHOR, anchorValues } from './offers/helpers';
import { OFFER_WIRING } from './offers/wiring';
import { COMPATIBLE_ADDON_EXCEPTIONS, INCOMPATIBLE_EQUIPMENT, conflictsOf, includedAddonProductsOf, includedOffersOf } from './relations';
import { attr, masterAttr, OFFERS, PRODUCTS, product } from './manifest-access';
import { referenceErrors } from './catalog-validate';

describe('relations', () => {
  it('conflict symmetry: a is in conflicts(b) exactly when b is in conflicts(a)', () => {
    for (const a of OFFER_WIRING) {
      for (const b of OFFER_WIRING) {
        expect(conflictsOf(a.key).includes(b.key), `${a.key} / ${b.key}`).toBe(conflictsOf(b.key).includes(a.key));
      }
    }
  });

  it('every home-internet offer conflicts with every other one and phone offers conflict with nothing', () => {
    const home = OFFER_WIRING.filter((w) => w.family === 'cable' || w.family === 'fixed-wireless');
    expect(home).toHaveLength(7);
    for (const offer of home) expect(conflictsOf(offer.key)).toHaveLength(6);
    for (const offer of OFFER_WIRING.filter((w) => w.family === 'phone' || w.family === 'addon')) expect(conflictsOf(offer.key)).toEqual([]);
  });

  it('every referenced key exists', () => {
    expect(referenceErrors(PRODUCTS)).toEqual([]);
  });

  it('included-addons on the anchor plan equals the anchors of the included add-on offers', () => {
    for (const offer of OFFER_WIRING.filter((w) => w.kind === 'base-package')) {
      const anchorIncluded = (anchorValues(offer.anchor)['included-addons'] as string[] | undefined) ?? [];
      expect(includedAddonProductsOf(offer.key), offer.key).toEqual(anchorIncluded);
    }
    expect(includedOffersOf('malva-offer-cable-gig')).toEqual(['malva-offer-modem-docsis31', 'malva-offer-appletv']);
  });

  it('required equipment is satisfied by included equipment: modem for cable, gateway for wireless', () => {
    for (const offer of OFFER_WIRING.filter((w) => w.family === 'cable')) expect(includedOffersOf(offer.key)).toContain('malva-offer-modem-docsis31');
    for (const offer of OFFER_WIRING.filter((w) => w.family === 'fixed-wireless')) expect(includedOffersOf(offer.key)).toContain('malva-offer-5g-gateway');
  });

  it('denormalised copies on the offer equal the anchor', () => {
    for (const offer of OFFERS) {
      const wiring = OFFER_WIRING.find((w) => w.key === offer.key);
      if (!wiring) throw new Error(offer.key);
      const anchor = anchorValues(wiring.anchor);
      for (const name of COPIED_FROM_ANCHOR) expect(masterAttr(offer, name), `${offer.key}.${name}`).toEqual(anchor[name]);
    }
  });

  it('exceptions are present: AX3000 cannot be combined with Air Lite and Netflix is allowed on Unlimited Max', () => {
    expect(INCOMPATIBLE_EQUIPMENT['malva-router-ax3000']).toEqual(['malva-offer-wireless-lite']);
    expect(masterAttr(product('malva-router-ax3000'), 'incompatible-with')).toEqual(['malva-offer-wireless-lite']);
    expect(COMPATIBLE_ADDON_EXCEPTIONS['malva-offer-phone-unlimited-max']).toEqual(['malva-offer-netflix']);
    expect(masterAttr(product('malva-offer-phone-unlimited-max'), 'compatible-addons')).toEqual(['malva-offer-netflix']);
    expect(masterAttr(product('malva-offer-phone-unlimited'), 'compatible-addons')).toBeUndefined();
  });

  it('offers carry their conflicts and included offers as attributes', () => {
    const cable = product('malva-offer-cable-500');
    expect(masterAttr(cable, 'conflicts-with')).toEqual(conflictsOf('malva-offer-cable-500'));
    expect(masterAttr(cable, 'included-offers')).toEqual(['malva-offer-modem-docsis31']);
    expect(attr(cable.masterVariant, 'offer-kind')).toBe('base-package');
    expect(masterAttr(product('malva-offer-spotify'), 'conflicts-with')).toBeUndefined();
  });
});
