import type { ProductShape, SelectorRenderer } from '@/lib/types';

/**
 * Selector configuration per product shape (workstream H, 3.4). Edit this file to change what the product page offers;
 * components never name an attribute. A selector shows only when the product has the attribute with more than one
 * distinct value. Required selectors without a default (coffee grind) start unselected.
 */
export interface SelectorConfig {
  attr: string;
  renderer: SelectorRenderer;
  required: boolean;
}

export const PRODUCT_TYPE_SHAPE: Record<string, ProductShape> = {
  'mcf-pods': 'pods',
  'mcf-coffee': 'coffee',
  'mcf-machine': 'machine',
  'mcf-accessory': 'accessory',
  'mcf-gift-set': 'gift',
};

/** Shape of a product from its product type key; unknown types read as accessories (no selectors beyond colour). */
export function shapeOf(typeKey: string | undefined): ProductShape {
  return (typeKey && PRODUCT_TYPE_SHAPE[typeKey]) || 'accessory';
}

export const SHAPE_SELECTORS: Record<ProductShape, SelectorConfig[]> = {
  pods: [{ attr: 'capsulesPerPack', renderer: 'pill', required: true }],
  coffee: [
    { attr: 'sizeGrams', renderer: 'pill', required: true },
    { attr: 'grind', renderer: 'pill', required: true },
  ],
  machine: [
    { attr: 'colour', renderer: 'colour', required: true },
    { attr: 'bundle', renderer: 'pill', required: true },
  ],
  accessory: [{ attr: 'colour', renderer: 'colour', required: true }],
  gift: [],
};

/**
 * Selectors that start unselected even when the landing variant has a value, so the shopper chooses on purpose
 * (spec "Required choice missing": the coffee grind).
 */
export const NO_DEFAULT_SELECTORS: readonly string[] = ['grind'];

/** Read-only facts per shape (rendered in Details), in display order. Every one is also kept out of the selectors. */
export const PDP_INFO_ATTRIBUTES: Record<ProductShape, string[]> = {
  pods: ['system', 'intensity', 'flavourNotes', 'origin', 'decaf', 'organic', 'fairtrade'],
  coffee: ['roast', 'origin', 'process', 'flavourNotes', 'intensity', 'brewMethods', 'decaf', 'organic', 'fairtrade'],
  machine: ['system', 'pressureBar', 'waterTankMl', 'powerWatts', 'features', 'warrantyMonths'],
  accessory: ['kind', 'material', 'capacityMl'],
  gift: ['contents', 'occasion'],
};

/** Attributes that never become selectors or facts (flags used by cards and the cart). */
export const ATTRIBUTE_BLOCKLIST: readonly string[] = ['badge', 'subscribable'];

/** Pack size labels for pods ("10 sleeve", "50 box", "100 box"); other counts read "<n> pack" (messages `pdp.pack.*`). */
export const PACK_LABEL_KEYS: Record<number, 'sleeve' | 'box'> = { 10: 'sleeve', 50: 'box', 100: 'box' };

/** Machine systems that take capsules, and the capsule system each one takes (Q-H-13). */
export const CAPSULE_SYSTEMS: readonly string[] = ['original', 'vertuo'];

/** Product type key of the pods and the category key whose subtree holds them (related products, "Goes well with"). */
export const PODS_CATEGORY_KEY = 'mcf-cat-pods';
