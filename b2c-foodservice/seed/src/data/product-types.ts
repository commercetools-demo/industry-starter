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
const base = (name: string, en: string, de: string, constraint: Constraint, searchable: boolean) => ({
  name, label: ls(en, de), isRequired: false, isSearchable: searchable, attributeConstraint: constraint, inputHint: 'SingleLine' as const,
});

const enumAttr = (name: string, en: string, de: string, keys: readonly string[], constraint: Constraint = 'SameForAll', searchable = true): AttributeDefinitionDraft => ({
  ...base(name, en, de, constraint, searchable), type: { name: 'enum', values: keys.map((key) => ({ key, label: label(key) })) },
});
const numAttr = (name: string, en: string, de: string, constraint: Constraint = 'SameForAll', searchable = true): AttributeDefinitionDraft => ({
  ...base(name, en, de, constraint, searchable), type: { name: 'number' },
});
const boolAttr = (name: string, en: string, de: string, constraint: Constraint = 'SameForAll'): AttributeDefinitionDraft => ({
  ...base(name, en, de, constraint, true), type: { name: 'boolean' },
});
const textAttr = (name: string, en: string, de: string, constraint: Constraint = 'SameForAll'): AttributeDefinitionDraft => ({
  ...base(name, en, de, constraint, true), type: { name: 'text' },
});
const ltextSet = (name: string, en: string, de: string): AttributeDefinitionDraft => ({
  ...base(name, en, de, 'SameForAll', true), type: { name: 'set', elementType: { name: 'ltext' } },
});
const textSet = (name: string, en: string, de: string): AttributeDefinitionDraft => ({
  ...base(name, en, de, 'SameForAll', true), type: { name: 'set', elementType: { name: 'text' } },
});
const enumSet = (name: string, en: string, de: string, keys: readonly string[]): AttributeDefinitionDraft => ({
  ...base(name, en, de, 'SameForAll', true), type: { name: 'set', elementType: { name: 'enum', values: keys.map((key) => ({ key, label: label(key) })) } },
});

/** Product-level attributes every type has so listing filters and badges work (SEED-PLAN section 6). */
const common: AttributeDefinitionDraft[] = [
  enumAttr('badge', 'Badge', 'Kennzeichen', BADGES),
  boolAttr('subscribable', 'Subscribable', 'Abo-fähig'),
];

export const productTypeDrafts: ProductTypeDraft[] = [
  {
    key: K.ptPods, name: 'Malva pods', description: 'Capsules compatible with Nespresso Original or Vertuo machines. Variants are pack sizes.',
    attributes: [
      enumAttr('system', 'System', 'System', ['original', 'vertuo']), numAttr('intensity', 'Intensity (1 to 13)', 'Intensität (1 bis 13)'),
      enumAttr('roast', 'Roast', 'Röstung', ROASTS), ltextSet('flavourNotes', 'Flavour notes', 'Geschmacksnoten'), textAttr('origin', 'Origin', 'Herkunft'),
      boolAttr('decaf', 'Decaf', 'Entkoffeiniert'), boolAttr('organic', 'Organic', 'Bio'), boolAttr('fairtrade', 'Fairtrade', 'Fairtrade'),
      numAttr('capsulesPerPack', 'Capsules per pack', 'Kapseln pro Packung', 'CombinationUnique', true),
      ...common,
    ],
  },
  {
    key: K.ptCoffee, name: 'Malva coffee', description: 'Whole bean and ground coffee. Variants are size crossed with grind.',
    attributes: [
      enumAttr('roast', 'Roast', 'Röstung', ROASTS), textAttr('origin', 'Origin', 'Herkunft'), textAttr('process', 'Process', 'Aufbereitung'),
      ltextSet('flavourNotes', 'Flavour notes', 'Geschmacksnoten'), numAttr('intensity', 'Intensity (1 to 13)', 'Intensität (1 bis 13)'),
      boolAttr('decaf', 'Decaf', 'Entkoffeiniert'), boolAttr('organic', 'Organic', 'Bio'), boolAttr('fairtrade', 'Fairtrade', 'Fairtrade'),
      enumSet('brewMethods', 'Brew methods', 'Zubereitungsarten', BREW_METHODS),
      numAttr('sizeGrams', 'Size (grams)', 'Größe (Gramm)', 'CombinationUnique', true),
      enumAttr('grind', 'Grind', 'Mahlgrad', GRINDS, 'CombinationUnique'),
      ...common,
    ],
  },
  {
    key: K.ptMachine, name: 'Malva machine', description: 'Coffee machines and grinders. Variants are colour crossed with bundle.',
    attributes: [
      enumAttr('system', 'System', 'System', MACHINE_SYSTEMS), numAttr('pressureBar', 'Pressure (bar)', 'Druck (bar)'), numAttr('waterTankMl', 'Water tank (ml)', 'Wassertank (ml)'),
      numAttr('powerWatts', 'Power (W)', 'Leistung (W)'), textSet('features', 'Features', 'Ausstattung'), numAttr('warrantyMonths', 'Warranty (months)', 'Garantie (Monate)'),
      enumAttr('colour', 'Colour', 'Farbe', COLOURS, 'CombinationUnique'), enumAttr('bundle', 'Bundle', 'Set', BUNDLES, 'CombinationUnique'),
      ...common,
    ],
  },
  {
    key: K.ptAccessory, name: 'Malva accessory', description: 'Cups, mugs, frothers, care and storage. Variants are colours.',
    attributes: [
      enumAttr('kind', 'Kind', 'Art', ACCESSORY_KINDS), textAttr('material', 'Material', 'Material'), numAttr('capacityMl', 'Capacity (ml)', 'Fassungsvermögen (ml)'),
      enumAttr('colour', 'Colour', 'Farbe', COLOURS, 'CombinationUnique'),
      ...common,
    ],
  },
  {
    key: K.ptGiftSet, name: 'Malva gift set', description: 'Curated gift sets.',
    attributes: [textAttr('contents', 'Contents', 'Inhalt'), enumAttr('occasion', 'Occasion', 'Anlass', OCCASIONS), ...common],
  },
];
