// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.

/** Languages the seed writes names in (D-030: US and Canada only; French for Canada is not built). */
export const LANGUAGES = ['en-US', 'en-CA'] as const;
export const COUNTRIES = ['US', 'CA'] as const;
export const CURRENCIES = ['USD', 'CAD'] as const;
export type Country = (typeof COUNTRIES)[number];
export type Currency = (typeof CURRENCIES)[number];
export type Locale = (typeof LANGUAGES)[number];

/** Market of each country: currency, locale, whether prices include tax (US and CA prices are tax-exclusive). */
export const MARKETS: Record<Country, { currency: Currency; locale: Locale; taxIncluded: boolean }> = {
  US: { currency: 'USD', locale: 'en-US', taxIncluded: false },
  CA: { currency: 'CAD', locale: 'en-CA', taxIncluded: false },
};

export type LString = Record<string, string>;
/** Localized string. `ca` falls back to the US text when the Canadian spelling is identical. */
export const ls = (us: string, ca: string = us): LString => ({ 'en-US': us, 'en-CA': ca });

export const slugify = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Every resource this seed creates has this key prefix (decision D-009). */
export const PREFIX = 'mcf-';

/** Every key the seed owns that is referenced from more than one file. */
export const K = {
  taxFood: 'mcf-tax-food',
  taxStandard: 'mcf-tax-standard',
  zoneUs: 'mcf-zone-us',
  zoneCa: 'mcf-zone-ca',
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
  typeReview: 'mcf-review',
  /** Owner-named key (R, D-043): no `mcf-` prefix, so it is a contract key. */
  typeInstoreOrder: 'instore-order-type',
  orderOrdered: 'mcf-order-ordered',
  orderPreparing: 'mcf-order-preparing',
  orderReady: 'mcf-order-ready-for-collection',
  orderCollected: 'mcf-order-collected',
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
 * Order states and custom types.
 */
export const CONTRACT_KEYS: readonly string[] = [
  K.orderOrdered, K.orderPreparing, K.orderReady, K.orderCollected,
  K.typeLine, K.typeStore, K.typeReview, K.typeInstoreOrder,
];

/** Deterministic 32-bit hash (FNV-1a). All "random looking" seed values derive from it so every run is identical. */
export const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
};
