import type { ProductDraft } from '../../types';
import { monthlyPrices, oneTimePrices, CABLE_ACTIVATION_FEE_CENTS, PLAN_PRICES, TERM_KEY } from '../prices';
import { buildOffer, type OfferSpec } from './helpers';

const CABLE_OFFERS = ['malva-offer-cable-100', 'malva-offer-cable-500', 'malva-offer-cable-gig', 'malva-offer-cable-existing-customer'];

/** Price steps (D-013): stored on the offer, read by L; the platform cannot step a price by period. */
export const CABLE_GIG_PRICE_STEPS = JSON.stringify([
  { fromMonth: 0, percentOff: 20 },
  { fromMonth: 12, percentOff: 10 },
  { fromMonth: 24, percentOff: 0 },
]);

const EXTRAS: Record<string, OfferSpec['extras']> = {
  'malva-offer-cable-100': { 'intro-free-months': 1 },
  'malva-offer-cable-gig': { 'price-steps': CABLE_GIG_PRICE_STEPS },
  'malva-offer-cable-existing-customer': { 'existing-customer': 'existing', audience: ['consumer', 'small-business'] },
};

/** The activation fee is also a one-time price on every cable variant (H reads it as `oneTimePrice`). */
function cableOffer(key: string): ProductDraft {
  return buildOffer({
    key,
    ...(key === 'malva-offer-cable-existing-customer' ? { name: { en: 'Cable 500, existing customers', de: 'Cable 500 für Bestandskunden' } } : {}),
    extras: EXTRAS[key],
    variants: PLAN_PRICES[key].map((v) => ({
      sku: v.sku,
      values: { 'contract-term': TERM_KEY[v.term], 'charge-type': 'monthly' },
      prices: [...monthlyPrices(v.usd), ...oneTimePrices(CABLE_ACTIVATION_FEE_CENTS)],
    })),
  });
}

export const cableOffers: ProductDraft[] = CABLE_OFFERS.map(cableOffer);
