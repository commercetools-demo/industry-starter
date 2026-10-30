// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { FieldDefinition, ProductTypeDraft, TypeDraft } from '@commercetools/platform-sdk';
import { COUNTRIES, K, ls, MARKETS, slugify } from './base';
import { oneTimeCents } from './prices';

/**
 * In-store data: the category custom type that says where a category is shown, and the ready-made drinks sold at the
 * self-checkout. The type key is owned by the in-store project setup, not by this seed, so it has no `mcf-` prefix and
 * `reset` never deletes it.
 */
export const INSTORE_CATEGORY_TYPE_KEY = 'instore-category-type';
export const INSTORE_VISIBILITY_FIELD = 'instoreVisibility';
/** onlyInStore: self-checkout only. onlyOnline: web storefront only. both: everywhere. none: nowhere. */
export const INSTORE_VISIBILITY_VALUES = ['onlyInStore', 'onlyOnline', 'both', 'none'] as const;
export type InstoreVisibility = (typeof INSTORE_VISIBILITY_VALUES)[number];

export const instoreVisibilityField: FieldDefinition = {
  name: INSTORE_VISIBILITY_FIELD, label: ls('In-store visibility'), required: false, inputHint: 'SingleLine',
  type: { name: 'Enum', values: INSTORE_VISIBILITY_VALUES.map((key) => ({ key, label: key })) },
};

export const instoreCategoryTypeDraft: TypeDraft = {
  key: INSTORE_CATEGORY_TYPE_KEY, name: ls('In-store category'), resourceTypeIds: ['category'], fieldDefinitions: [instoreVisibilityField],
};

export const PT_READY_DRINK = 'mcf-ready-drink';
export const CAT_INSTORE_DRINKS = 'mcf-cat-instore-drinks';
export const SIZES = ['small', 'large'] as const;

export const readyDrinkProductType: ProductTypeDraft = {
  key: PT_READY_DRINK, name: 'Malva ready-made drink', description: 'Made-to-order drinks sold at the self-checkout.',
  attributes: [{
    name: 'size', label: ls('Size'), isRequired: true, isSearchable: true, attributeConstraint: 'CombinationUnique', inputHint: 'SingleLine',
    type: { name: 'enum', values: [{ key: 'small', label: 'Small (12 oz)' }, { key: 'large', label: 'Large (16 oz)' }] },
  }],
};

export const instoreCategoryDraft = {
  key: CAT_INSTORE_DRINKS, name: ls('Ready-made coffee'), slug: ls('ready-made-coffee'),
  description: ls('Freshly made drinks, ordered at the self-checkout.'), orderHint: '0.9',
  custom: { type: { typeId: 'type', key: INSTORE_CATEGORY_TYPE_KEY }, fields: { [INSTORE_VISIBILITY_FIELD]: 'onlyInStore' satisfies InstoreVisibility } },
};

/** Name, description and the small and large price in US cents (CAD derived like the rest of the seed). */
const DRINKS: [code: string, name: string, description: string, small: number, large: number][] = [
  ['AMERICANO', 'Americano', 'Espresso topped up with hot water.', 325, 375],
  ['LATTE', 'Latte', 'Espresso with steamed milk and a thin layer of foam.', 425, 495],
  ['CAPPUCCINO', 'Cappuccino', 'Espresso with equal parts steamed milk and foam.', 425, 495],
  ['FLAT-WHITE', 'Flat White', 'Double espresso with velvety steamed milk.', 450, 520],
  ['MOCHA', 'Mocha', 'Espresso, chocolate and steamed milk.', 475, 545],
  ['ICED-LATTE', 'Iced Latte', 'Espresso and cold milk over ice.', 450, 520],
  ['COLD-BREW', 'Cold Brew', 'Slow-steeped coffee served over ice.', 400, 460],
  ['DRIP', 'Drip Coffee', 'Fresh filter coffee, house blend.', 275, 325],
];

const skuOf = (code: string, size: (typeof SIZES)[number]): string => `MCF-RD-${code}-${size.toUpperCase()}`;
export const READY_DRINK_SKUS = DRINKS.flatMap(([code]) => SIZES.map((s) => skuOf(code, s)));

const variant = (code: string, size: (typeof SIZES)[number], usd: number): Record<string, unknown> => ({
  sku: skuOf(code, size), key: skuOf(code, size).toLowerCase(),
  attributes: [{ name: 'size', value: size }],
  prices: COUNTRIES.map((country) => ({
    key: `${country.toLowerCase()}-one-time`, country,
    value: { currencyCode: MARKETS[country].currency, centAmount: oneTimeCents(usd, MARKETS[country].currency) },
  })),
});

export const readyDrinkDrafts = (): Record<string, unknown>[] =>
  DRINKS.map(([code, name, description, small, large]) => ({
    key: `mcf-rd-${code.toLowerCase()}`, productType: { typeId: 'product-type', key: PT_READY_DRINK },
    taxCategory: { typeId: 'tax-category', key: K.taxFood },
    name: ls(name), slug: ls(slugify(`ready-${name}`)), description: ls(description),
    categories: [{ typeId: 'category', key: CAT_INSTORE_DRINKS }],
    masterVariant: variant(code, 'small', small), variants: [variant(code, 'large', large)],
    searchKeywords: { 'en-US': [{ text: name }], 'en-CA': [{ text: name }] },
    publish: true,
  }));
