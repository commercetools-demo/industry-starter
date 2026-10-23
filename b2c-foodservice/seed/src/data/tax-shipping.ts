// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ShippingMethodDraft, TaxCategoryDraft, ZoneDraft } from '@commercetools/platform-sdk';
import { K, ls } from './base';

/**
 * Tax by market (D-036; the owner confirms the rates, this is not tax advice). Prices are tax-exclusive in both markets.
 * US: food 0%, standard 8% country rate (fallback for `changeCountryTaxRateFallbackEnabled`), New York 8.875%.
 * Canada: food 0% (zero-rated), standard 5% GST as a country-level rate (no state, so the fallback applies to every
 * province). Provincial taxes (HST/PST/QST) are not modelled; noted for an accountant.
 */
export const taxCategoryDrafts: TaxCategoryDraft[] = [
  {
    key: K.taxFood,
    name: 'Malva food and coffee',
    description: 'Coffee and capsules. US 0% (default) and Canada zero-rated 0%.',
    rates: [
      { name: 'US food 0%', amount: 0, includedInPrice: false, country: 'US' },
      { name: 'CA zero-rated food 0%', amount: 0, includedInPrice: false, country: 'CA' },
    ],
  },
  {
    key: K.taxStandard,
    name: 'Malva standard',
    description: 'Machines, accessories, gift sets and shipping. US country rate 8% is the fallback, New York 8.875%. Canada GST 5%.',
    rates: [
      { name: 'US sales tax fallback 8%', amount: 0.08, includedInPrice: false, country: 'US' },
      { name: 'US NY sales tax 8.875%', amount: 0.08875, includedInPrice: false, country: 'US', state: 'NY' },
      { name: 'CA GST 5%', amount: 0.05, includedInPrice: false, country: 'CA' },
    ],
  },
];

export const zoneDrafts: ZoneDraft[] = [
  { key: K.zoneUs, name: 'Malva United States', description: 'Shipping zone: United States', locations: [{ country: 'US' }] },
  { key: K.zoneCa, name: 'Malva Canada', description: 'Shipping zone: Canada', locations: [{ country: 'CA' }] },
];

const usd = (centAmount: number) => ({ currencyCode: 'USD', centAmount });
const cad = (centAmount: number) => ({ currencyCode: 'CAD', centAmount });
const tax = { typeId: 'tax-category' as const, key: K.taxStandard };
const zone = (key: string) => ({ typeId: 'zone' as const, key });

/**
 * Shipping rates per zone (one currency per zone) with a free-above tier on standard shipping. `mcf-collect` is the
 * method that goes with collection lines (fulfilment-and-availability-model); it costs nothing and exists in the US
 * zone only (D-035: Canada is delivery only). D-034: standard carrier delivery; express stays as a priced option.
 */
export const shippingMethodDrafts: ShippingMethodDraft[] = [
  {
    key: K.shipStandard, name: 'Standard shipping', localizedName: ls('Standard shipping'), taxCategory: tax, isDefault: true,
    zoneRates: [
      { zone: zone(K.zoneUs), shippingRates: [{ price: usd(695), freeAbove: usd(7500) }] },
      { zone: zone(K.zoneCa), shippingRates: [{ price: cad(895), freeAbove: cad(9900) }] },
    ],
  },
  {
    key: K.shipExpress, name: 'Express shipping', localizedName: ls('Express shipping'), taxCategory: tax, isDefault: false,
    zoneRates: [
      { zone: zone(K.zoneUs), shippingRates: [{ price: usd(1495) }] },
      { zone: zone(K.zoneCa), shippingRates: [{ price: cad(1995) }] },
    ],
  },
  {
    key: K.shipCollect, name: 'Collect in store', localizedName: ls('Collect in store'), taxCategory: tax, isDefault: false,
    zoneRates: [
      { zone: zone(K.zoneUs), shippingRates: [{ price: usd(0) }] },
    ],
  },
];
