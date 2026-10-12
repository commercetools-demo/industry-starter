import type { ProductDraft } from '../../types';
import { ADDON_PRICES, monthlyPrices, oneTimePrices, ONE_TIME_ADDON_PRICES, TERM_KEY } from '../prices';
import { buildOffer, type OfferSpec } from './helpers';

/**
 * Dependencies between add-on offers (the storefront enforces them; see `lib/offers/dependencies.ts`):
 *  - Apple Music is sold together with Apple TV+ (`requires-offers`).
 *  - Professional installation replaces the self-installation kit when it is added (`negates-offers`).
 *  - The Regional Sports Pass is sold in a few states only (`eligible-regions`).
 */
export const ADDON_EXTRAS: Record<string, OfferSpec['extras']> = {
  'malva-offer-applemusic': { 'requires-offers': ['malva-offer-appletv'] },
  'malva-offer-pro-install': { 'negates-offers': ['malva-offer-diy-install'] },
  'malva-offer-regional-sports': { 'eligible-regions': ['TX', 'NC', 'WA'] },
};

const monthly: ProductDraft[] = Object.entries(ADDON_PRICES).map(([key, price]) =>
  buildOffer({
    key,
    extras: ADDON_EXTRAS[key],
    variants: [{ sku: price.sku, values: { 'contract-term': TERM_KEY.M2M, 'charge-type': 'monthly' }, prices: monthlyPrices(price.usd) }],
  }),
);

const oneTime: ProductDraft[] = Object.entries(ONE_TIME_ADDON_PRICES).map(([key, price]) =>
  buildOffer({
    key,
    extras: ADDON_EXTRAS[key],
    variants: [{ sku: price.sku, values: { 'contract-term': TERM_KEY.M2M, 'charge-type': 'one-time' }, prices: oneTimePrices(price.usd) }],
  }),
);

export const addonOffers: ProductDraft[] = [...monthly, ...oneTime];
