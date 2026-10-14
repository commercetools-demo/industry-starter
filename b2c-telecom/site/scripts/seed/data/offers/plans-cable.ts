/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { ProductDraft } from '../../types';
import { BUNDLE_OFFER_KEY, BUNDLE_PRICES, monthlyPrices, smallBusinessPrices, oneTimePrices, CABLE_ACTIVATION_FEE_CENTS, PLAN_PRICES, TERM_KEY } from '../prices';
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
      prices: [...monthlyPrices(v.usd), ...smallBusinessPrices(v.usd), ...oneTimePrices(CABLE_ACTIVATION_FEE_CENTS)],
    })),
  });
}

export const cableOffers: ProductDraft[] = CABLE_OFFERS.map(cableOffer);

/**
 * The bundle: cable internet plus a phone plan for one monthly price, anchoring both plans' products. The bundled price is the offer's own
 * price (no cart discount); small-business and existing customers have their own prices, selected by the platform for their group.
 */
export const bundleOffer: ProductDraft = buildOffer({
  key: BUNDLE_OFFER_KEY,
  name: { en: 'Cable 500 + Essential phone', de: 'Cable 500 + Phone Essential' },
  extras: { anchors: ['malva-cable-500', 'malva-phone-essential'] },
  variants: [
    {
      sku: BUNDLE_PRICES.sku,
      values: { 'contract-term': TERM_KEY['24M'], 'charge-type': 'monthly' },
      prices: [
        ...monthlyPrices(BUNDLE_PRICES.usd),
        ...Object.entries(BUNDLE_PRICES.groups).flatMap(([customerGroup, usd]) => monthlyPrices(usd, undefined, { customerGroup })),
        ...oneTimePrices(CABLE_ACTIVATION_FEE_CENTS),
      ],
    },
  ],
});
