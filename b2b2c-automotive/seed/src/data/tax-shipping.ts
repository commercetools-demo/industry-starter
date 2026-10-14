// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ShippingMethodDraft, TaxCategoryDraft, ZoneDraft } from '@commercetools/platform-sdk';
import { K, ls } from './base';

/**
 * DE 19 % VAT and GB 20 % VAT are included in the price. US is a 0 % placeholder (sales tax is state-specific and not
 * yet decided, see Q-S02); with `countryTaxRateFallbackEnabled` a US address without a state still resolves a rate.
 */
export const taxCategoryDraft: TaxCategoryDraft = {
  key: K.taxParts,
  name: 'Malva parts',
  description: 'Standard rate for automotive parts and shipping',
  rates: [
    { name: 'DE VAT 19%', amount: 0.19, includedInPrice: true, country: 'DE' },
    { name: 'GB VAT 20%', amount: 0.2, includedInPrice: true, country: 'GB' },
    { name: 'US sales tax placeholder 0%', amount: 0, includedInPrice: false, country: 'US' },
  ],
};

export const zoneDrafts: ZoneDraft[] = [
  { key: K.zoneDe, name: 'Malva Germany', description: 'Authorised territory: Germany', locations: [{ country: 'DE' }] },
  { key: K.zoneUs, name: 'Malva United States', description: 'Authorised territory: United States', locations: [{ country: 'US' }] },
];

const eur = (centAmount: number) => ({ currencyCode: 'EUR', centAmount });
const usd = (centAmount: number) => ({ currencyCode: 'USD', centAmount });
const tax = { typeId: 'tax-category' as const, key: K.taxParts };
const zone = (key: string) => ({ typeId: 'zone' as const, key });

/**
 * Pickup in store is modelled as a shipping method with a zero rate. Semantic: the storefront offers it only together
 * with a branch (a supply channel of the store) and puts that channel on the line items (`supplyChannel`), so stock
 * is checked at the branch; a cart with this method carries custom field `pickupBranchKey`. It needs no address.
 */
export const shippingMethodDrafts: ShippingMethodDraft[] = [
  {
    key: K.shipStandard, name: 'Standard shipping', localizedName: ls('Standardversand', 'Standard shipping'), taxCategory: tax, isDefault: true,
    zoneRates: [
      { zone: zone(K.zoneDe), shippingRates: [{ price: eur(590), freeAbove: eur(15000) }] },
      { zone: zone(K.zoneUs), shippingRates: [{ price: usd(990), freeAbove: usd(17500) }] },
    ],
  },
  {
    key: K.shipExpress, name: 'Express shipping', localizedName: ls('Expressversand', 'Express shipping'), taxCategory: tax, isDefault: false,
    zoneRates: [
      { zone: zone(K.zoneDe), shippingRates: [{ price: eur(1290) }] },
      { zone: zone(K.zoneUs), shippingRates: [{ price: usd(2490) }] },
    ],
  },
  {
    key: K.shipPickup, name: 'Pickup in store', localizedName: ls('Abholung in der Filiale', 'Pickup in store'), taxCategory: tax, isDefault: false,
    zoneRates: [
      { zone: zone(K.zoneDe), shippingRates: [{ price: eur(0) }] },
      { zone: zone(K.zoneUs), shippingRates: [{ price: usd(0) }] },
    ],
  },
];
