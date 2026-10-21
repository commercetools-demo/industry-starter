// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { AttributeDefinitionDraft, ProductTypeDraft } from '@commercetools/platform-sdk';
import { K, ls } from './base';

export const ROASTS = ['light', 'medium', 'medium-dark', 'dark'] as const;
export const BADGES = ['none', 'bestseller', 'new', 'limited-edition'] as const;
export const BREW_METHODS = ['espresso', 'filter', 'french-press', 'moka', 'cold-brew'] as const;
export const GRINDS = ['whole-bean', 'espresso', 'filter', 'french-press', 'moka'] as const;
export const MACHINE_SYSTEMS = ['original', 'vertuo', 'bean-to-cup', 'espresso', 'filter', 'grinder'] as const;
export const COLOURS = ['black', 'white', 'red', 'silver', 'cream'] as const;
export const BUNDLES = ['machine-only', 'starter-capsules'] as const;
export const ACCESSORY_KINDS = ['cup', 'mug', 'frother', 'descaler', 'storage', 'grinder-accessory'] as const;
export const OCCASIONS = ['birthday', 'thank-you', 'housewarming', 'holiday', 'discovery'] as const;

type Constraint = 'None' | 'SameForAll' | 'CombinationUnique';

const label = (key: string): string => key.split('-').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ');
const base = (name: string, en: string, constraint: Constraint, searchable: boolean) => ({
  name, label: ls(en), isRequired: false, isSearchable: searchable, attributeConstraint: constraint, inputHint: 'SingleLine' as const,
});

const enumAttr = (name: string, en: string, keys: readonly string[], constraint: Constraint = 'SameForAll', searchable = true): AttributeDefinitionDraft => ({
  ...base(name, en, constraint, searchable), type: { name: 'enum', values: keys.map((key) => ({ key, label: label(key) })) },
});
const numAttr = (name: string, en: string, constraint: Constraint = 'SameForAll', searchable = true): AttributeDefinitionDraft => ({
  ...base(name, en, constraint, searchable), type: { name: 'number' },
});
const boolAttr = (name: string, en: string, constraint: Constraint = 'SameForAll'): AttributeDefinitionDraft => ({
  ...base(name, en, constraint, true), type: { name: 'boolean' },
});
const textAttr = (name: string, en: string, constraint: Constraint = 'SameForAll'): AttributeDefinitionDraft => ({
  ...base(name, en, constraint, true), type: { name: 'text' },
});
const ltextSet = (name: string, en: string): AttributeDefinitionDraft => ({
  ...base(name, en, 'SameForAll', true), type: { name: 'set', elementType: { name: 'ltext' } },
});
const textSet = (name: string, en: string): AttributeDefinitionDraft => ({
  ...base(name, en, 'SameForAll', true), type: { name: 'set', elementType: { name: 'text' } },
});
const enumSet = (name: string, en: string, keys: readonly string[]): AttributeDefinitionDraft => ({
  ...base(name, en, 'SameForAll', true), type: { name: 'set', elementType: { name: 'enum', values: keys.map((key) => ({ key, label: label(key) })) } },
});

/** Product-level attributes every type has so listing filters and badges work (SEED-PLAN section 6). */
const common: AttributeDefinitionDraft[] = [
  enumAttr('badge', 'Badge', BADGES),
  boolAttr('subscribable', 'Subscribable'),
];

export const productTypeDrafts: ProductTypeDraft[] = [
  {
    key: K.ptPods, name: 'Malva pods', description: 'Capsules compatible with Nespresso Original or Vertuo machines. Variants are pack sizes.',
    attributes: [
      enumAttr('system', 'System', ['original', 'vertuo']), numAttr('intensity', 'Intensity (1 to 13)'),
      enumAttr('roast', 'Roast', ROASTS), ltextSet('flavourNotes', 'Flavour notes'), textAttr('origin', 'Origin'),
      boolAttr('decaf', 'Decaf'), boolAttr('organic', 'Organic'), boolAttr('fairtrade', 'Fairtrade'),
      numAttr('capsulesPerPack', 'Capsules per pack', 'CombinationUnique', true),
      ...common,
    ],
  },
  {
    key: K.ptCoffee, name: 'Malva coffee', description: 'Whole bean and ground coffee. Variants are size crossed with grind.',
    attributes: [
      enumAttr('roast', 'Roast', ROASTS), textAttr('origin', 'Origin'), textAttr('process', 'Process'),
      ltextSet('flavourNotes', 'Flavour notes'), numAttr('intensity', 'Intensity (1 to 13)'),
      boolAttr('decaf', 'Decaf'), boolAttr('organic', 'Organic'), boolAttr('fairtrade', 'Fairtrade'),
      enumSet('brewMethods', 'Brew methods', BREW_METHODS),
      numAttr('sizeGrams', 'Size (grams)', 'CombinationUnique', true),
      enumAttr('grind', 'Grind', GRINDS, 'CombinationUnique'),
      ...common,
    ],
  },
  {
    key: K.ptMachine, name: 'Malva machine', description: 'Coffee machines and grinders. Variants are colour crossed with bundle.',
    attributes: [
      enumAttr('system', 'System', MACHINE_SYSTEMS), numAttr('pressureBar', 'Pressure (bar)'), numAttr('waterTankMl', 'Water tank (ml)'),
      numAttr('powerWatts', 'Power (W)'), textSet('features', 'Features'), numAttr('warrantyMonths', 'Warranty (months)'),
      enumAttr('colour', 'Colour', COLOURS, 'CombinationUnique'), enumAttr('bundle', 'Bundle', BUNDLES, 'CombinationUnique'),
      ...common,
    ],
  },
  {
    key: K.ptAccessory, name: 'Malva accessory', description: 'Cups, mugs, frothers, care and storage. Variants are colours.',
    attributes: [
      enumAttr('kind', 'Kind', ACCESSORY_KINDS), textAttr('material', 'Material'), numAttr('capacityMl', 'Capacity (ml)'),
      enumAttr('colour', 'Colour', COLOURS, 'CombinationUnique'),
      ...common,
    ],
  },
  {
    key: K.ptGiftSet, name: 'Malva gift set', description: 'Curated gift sets.',
    attributes: [textAttr('contents', 'Contents'), enumAttr('occasion', 'Occasion', OCCASIONS), ...common],
  },
];
