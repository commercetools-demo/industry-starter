import type { ProductDraft } from '../../types';
import { monthlyPrices, oneTimePrices, CABLE_ACTIVATION_FEE_CENTS, PLAN_PRICES, TERM_KEY } from '../prices';
import { buildOffer, type OfferSpec } from './helpers';

const CABLE_OFFERS = ['malva-offer-cable-100', 'malva-offer-cable-500', 'malva-offer-cable-gig', 'malva-offer-cable-existing-customer'];

const EXTRAS: Record<string, OfferSpec['extras']> = {
  'malva-offer-cable-100': { 'intro-free-months': 1 },
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
