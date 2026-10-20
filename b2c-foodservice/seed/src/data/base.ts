// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.

/** Languages the seed writes names in (decision D-004). */
export const LANGUAGES = ['en-US', 'en-GB', 'de-DE'] as const;
export const COUNTRIES = ['US', 'DE', 'GB'] as const;
export const CURRENCIES = ['USD', 'EUR', 'GBP'] as const;
export type Country = (typeof COUNTRIES)[number];
export type Currency = (typeof CURRENCIES)[number];

/** Market of each country: currency, locale, whether prices include tax. */
export const MARKETS: Record<Country, { currency: Currency; locale: 'en-US' | 'en-GB' | 'de-DE'; taxIncluded: boolean }> = {
  US: { currency: 'USD', locale: 'en-US', taxIncluded: false },
  DE: { currency: 'EUR', locale: 'de-DE', taxIncluded: true },
  GB: { currency: 'GBP', locale: 'en-GB', taxIncluded: true },
};

export type LString = Record<string, string>;
/** Localized string. `gb` falls back to the US text when the British spelling is identical. */
export const ls = (en: string, de: string, gb: string = en): LString => ({ 'en-US': en, 'en-GB': gb, 'de-DE': de });

export const slugify = (s: string): string =>
  s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Every resource this seed creates has this key prefix (decision D-009). */
export const PREFIX = 'mcf-';

/** Every key the seed owns that is referenced from more than one file. */
export const K = {
  taxFood: 'mcf-tax-food',
  taxStandard: 'mcf-tax-standard',
  zoneUs: 'mcf-zone-us',
  zoneDe: 'mcf-zone-de',
  zoneGb: 'mcf-zone-gb',
  shipStandard: 'mcf-ship-standard',
  shipExpress: 'mcf-ship-express',
  shipCollect: 'mcf-collect',
  ptPods: 'mcf-pods',
  ptCoffee: 'mcf-coffee',
  ptMachine: 'mcf-machine',
  ptAccessory: 'mcf-accessory',
  ptGiftSet: 'mcf-gift-set',
  typeLine: 'mcf-line-fulfilment',
  typeStore: 'mcf-store',
  orderOrdered: 'mcf-order-ordered',
  orderPreparing: 'mcf-order-preparing',
  orderReady: 'mcf-order-ready-for-collection',
  orderCollected: 'mcf-order-collected',
  reviewPending: 'mcf-review-pending',
  reviewApproved: 'mcf-review-approved',
  rpEvery2Weeks: 'mcf-every-2-weeks',
  rpEveryMonth: 'mcf-every-month',
  rpEvery2Months: 'mcf-every-2-months',
  rpEvery3Months: 'mcf-every-3-months',
  savedMaya: 'mcf-saved-maya',
  discountWelcome: 'mcf-discount-welcome10',
  discountFreeShip: 'mcf-discount-freeship',
  discountCoffee15: 'mcf-discount-coffee15',
  discountSeasonal: 'mcf-discount-seasonal-machines',
} as const;

/**
 * Keys other parts of the app read by fixed name. All of them also carry the `mcf-` prefix today; they are listed
 * explicitly so that `reset` and the key test accept exactly these even if one is ever renamed without the prefix.
 * Order states, review states and custom types.
 */
export const CONTRACT_KEYS: readonly string[] = [
  K.orderOrdered, K.orderPreparing, K.orderReady, K.orderCollected,
  K.reviewPending, K.reviewApproved,
  K.typeLine, K.typeStore,
];

/** Deterministic 32-bit hash (FNV-1a). All "random looking" seed values derive from it so every run is identical. */
export const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
};
