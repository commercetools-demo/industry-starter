// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ShippingMethodDraft, TaxCategoryDraft, ZoneDraft } from '@commercetools/platform-sdk';
import { K, ls } from './base';

/**
 * Tax by market (SEED-PLAN section 2; Q-B-03: the owner confirms the rates, this is not tax advice).
 * US prices are tax-exclusive (rate includedInPrice false), DE and GB prices are tax-inclusive.
 * The US country rate (no state) is the fallback used when `changeCountryTaxRateFallbackEnabled` is on and an address
 * has a state without its own rate; New York has its own rate.
 */
export const taxCategoryDrafts: TaxCategoryDraft[] = [
  {
    key: K.taxFood,
    name: 'Malva food and coffee',
    description: 'Coffee and capsules. US 0% and GB 0% are defaults (Q-S-1), DE reduced 7%.',
    rates: [
      { name: 'US food 0%', amount: 0, includedInPrice: false, country: 'US' },
      { name: 'DE reduced VAT 7%', amount: 0.07, includedInPrice: true, country: 'DE' },
      { name: 'GB zero-rated food 0%', amount: 0, includedInPrice: true, country: 'GB' },
    ],
  },
  {
    key: K.taxStandard,
    name: 'Malva standard',
    description: 'Machines, accessories, gift sets and shipping. US country rate 8% is the fallback, New York 8.875%.',
    rates: [
      { name: 'US sales tax fallback 8%', amount: 0.08, includedInPrice: false, country: 'US' },
      { name: 'US NY sales tax 8.875%', amount: 0.08875, includedInPrice: false, country: 'US', state: 'NY' },
      { name: 'DE VAT 19%', amount: 0.19, includedInPrice: true, country: 'DE' },
      { name: 'GB VAT 20%', amount: 0.2, includedInPrice: true, country: 'GB' },
    ],
  },
];

export const zoneDrafts: ZoneDraft[] = [
  { key: K.zoneUs, name: 'Malva United States', description: 'Shipping zone: United States', locations: [{ country: 'US' }] },
  { key: K.zoneDe, name: 'Malva Germany', description: 'Shipping zone: Germany', locations: [{ country: 'DE' }] },
  { key: K.zoneGb, name: 'Malva United Kingdom', description: 'Shipping zone: United Kingdom', locations: [{ country: 'GB' }] },
];

const usd = (centAmount: number) => ({ currencyCode: 'USD', centAmount });
const eur = (centAmount: number) => ({ currencyCode: 'EUR', centAmount });
const gbp = (centAmount: number) => ({ currencyCode: 'GBP', centAmount });
const tax = { typeId: 'tax-category' as const, key: K.taxStandard };
const zone = (key: string) => ({ typeId: 'zone' as const, key });

/**
 * Shipping rates per zone (one currency per zone) with a free-above tier on standard shipping. `mcf-collect` is the
 * method that goes with collection lines (fulfilment-and-availability-model); it costs nothing.
 */
export const shippingMethodDrafts: ShippingMethodDraft[] = [
  {
    key: K.shipStandard, name: 'Standard shipping', localizedName: ls('Standard shipping', 'Standardversand'), taxCategory: tax, isDefault: true,
    zoneRates: [
      { zone: zone(K.zoneUs), shippingRates: [{ price: usd(695), freeAbove: usd(7500) }] },
      { zone: zone(K.zoneDe), shippingRates: [{ price: eur(490), freeAbove: eur(6000) }] },
      { zone: zone(K.zoneGb), shippingRates: [{ price: gbp(395), freeAbove: gbp(5000) }] },
    ],
  },
  {
    key: K.shipExpress, name: 'Express shipping', localizedName: ls('Express shipping', 'Expressversand'), taxCategory: tax, isDefault: false,
    zoneRates: [
      { zone: zone(K.zoneUs), shippingRates: [{ price: usd(1495) }] },
      { zone: zone(K.zoneDe), shippingRates: [{ price: eur(1290) }] },
      { zone: zone(K.zoneGb), shippingRates: [{ price: gbp(995) }] },
    ],
  },
  {
    key: K.shipCollect, name: 'Collect in store', localizedName: ls('Collect in store', 'Abholung im Store'), taxCategory: tax, isDefault: false,
    zoneRates: [
      { zone: zone(K.zoneUs), shippingRates: [{ price: usd(0) }] },
      { zone: zone(K.zoneDe), shippingRates: [{ price: eur(0) }] },
      { zone: zone(K.zoneGb), shippingRates: [{ price: gbp(0) }] },
    ],
  },
];
