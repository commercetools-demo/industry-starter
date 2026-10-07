// Offers for the cart tests: J's fixtures (same keys, rules, exceptions) plus real terms, SKUs and prices.
import * as fx from '@/lib/offers/__fixtures__/offers';
import type { Money, Offer, OfferVariant, PlanFacts, TermKey, TermMonths } from '@/lib/types';

export const usd = (centAmount: number): Money => ({ centAmount, currencyCode: 'USD' });

export function variant(sku: string, term: TermKey | null, termMonths: TermMonths | null, price: { recurring?: number; oneTime?: number }, isMaster = false, extra: Partial<OfferVariant> = {}): OfferVariant {
  return {
    id: 1,
    sku,
    isMaster,
    term,
    termMonths,
    ...(price.recurring === undefined ? {} : { recurringPrice: usd(price.recurring) }),
    ...(price.oneTime === undefined ? {} : { oneTimePrice: usd(price.oneTime) }),
    images: [],
    attributes: {},
    ...extra,
  };
}

const planFacts = (offer: Offer, patch: Partial<PlanFacts>): Offer => ({ ...offer, facts: { ...(offer.facts as PlanFacts), ...patch } });

export const cable500: Offer = {
  ...planFacts(fx.cable500, {
    typicalDownloadMbps: 525,
    typicalUploadMbps: 48,
    typicalLatencyMs: 13,
    dataGb: -1,
    priceLockMonths: 24,
    earlyTerminationFee: '$10 x months remaining',
    highlights: ['Up to 500 Mbps', 'Unlimited data', 'Free modem', 'Fourth bullet'],
  }),
  description: 'Fast cable internet',
  variants: [
    variant('MLV-CBL-500-24M', '24-months', 24, { recurring: 5999, oneTime: 2500 }, true),
    variant('MLV-CBL-500-M2M', 'month-to-month', 0, { recurring: 6999, oneTime: 2500 }),
  ],
  headline: { recurring: usd(5999), oneTime: usd(2500), term: '24-months', termMonths: 24 },
};

export const cable100: Offer = {
  ...planFacts(fx.cable100, { typicalDownloadMbps: 105, typicalUploadMbps: 10, typicalLatencyMs: 14, dataGb: -1, priceLockMonths: 24, earlyTerminationFee: '$10 x months remaining' }),
  variants: [
    variant('MLV-CBL-100-24M', '24-months', 24, { recurring: 3999, oneTime: 2500 }, true),
    variant('MLV-CBL-100-M2M', 'month-to-month', 0, { recurring: 4999, oneTime: 2500 }),
  ],
};

export const cableGig: Offer = {
  ...planFacts(fx.cableGig, { typicalDownloadMbps: 1000, typicalUploadMbps: 100, typicalLatencyMs: 12, dataGb: -1, priceLockMonths: 24, earlyTerminationFee: '$10 x months remaining' }),
  variants: [variant('MLV-CBL-GIG-24M', '24-months', 24, { recurring: 7999, oneTime: 2500 }, true)],
};

export const wireless5g: Offer = {
  ...planFacts(fx.wireless5g, { typicalDownloadMbps: 200, typicalUploadMbps: 20, typicalLatencyMs: 25, dataGb: -1, priceLockMonths: 12, earlyTerminationFee: 'None' }),
  variants: [variant('MLV-AIR-5G-12M', '12-months', 12, { recurring: 5500 }, true)],
};

const phoneBase = { typicalDownloadMbps: 100, typicalUploadMbps: 20, typicalLatencyMs: 30, earlyTerminationFee: 'None' };

export const phoneUnlimited: Offer = {
  ...planFacts(fx.phoneUnlimited, { ...phoneBase, dataGb: -1, priceLockMonths: 24, highlights: ['Unlimited talk, text and data'] }),
  variants: [
    variant('MLV-PHN-UNL-24M', '24-months', 24, { recurring: 5000 }, true),
    variant('MLV-PHN-UNL-M2M', 'month-to-month', 0, { recurring: 5500 }),
  ],
};

export const phoneEssential: Offer = {
  ...planFacts(fx.phoneEssential, { ...phoneBase, dataGb: 5, priceLockMonths: 0 }),
  variants: [variant('MLV-PHN-ESS-M2M', 'month-to-month', 0, { recurring: 2500 }, true)],
};

export const spotify: Offer = { ...fx.spotify, variants: [variant('MLV-ADD-SPOTIFY-MTH', 'month-to-month', 0, { recurring: 1000 }, true)] };
export const appletv: Offer = { ...fx.appletv, variants: [variant('MLV-ADD-APPLETV-MTH', 'month-to-month', 0, { recurring: 999 }, true)] };
export const deviceProtect: Offer = { ...fx.deviceProtect, variants: [variant('MLV-ADD-DEVCARE-MTH', 'month-to-month', 0, { recurring: 1200 }, true)] };
export const routerAx3000: Offer = {
  ...fx.routerAx3000,
  variants: [variant('MLV-EQP-AX3000-RENT', null, null, { recurring: 800 }, true, { availableQuantity: 10 }), variant('MLV-EQP-AX3000-BUY', null, null, { oneTime: 12999 }, false, { availableQuantity: 10 })],
};

export const CART_OFFERS: Offer[] = fx.ALL_OFFERS.map((offer) => {
  const replaced = [cable500, cable100, cableGig, wireless5g, phoneUnlimited, phoneEssential, spotify, appletv, deviceProtect, routerAx3000].find((candidate) => candidate.key === offer.key);
  return replaced ?? offer;
});
export const cartOffersByKey = (): Record<string, Offer> => Object.fromEntries(CART_OFFERS.map((offer) => [offer.key, offer]));
