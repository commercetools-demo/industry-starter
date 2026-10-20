// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { CategoryDraft } from '@commercetools/platform-sdk';
import { ls, type LString } from './base';

/** Category tree (SEED-PLAN section 7). Parents come before children so references resolve. Slugs are unique per language. */
export interface CategoryDef {
  key: string;
  parent?: string;
  en: string;
  gb?: string;
  de: string;
  slugEn: string;
  slugDe: string;
  description: [en: string, de: string];
}

const C = (key: string, parent: string | undefined, en: string, de: string, slugEn: string, slugDe: string, desc: [string, string], gb?: string): CategoryDef =>
  ({ key, parent, en, de, slugEn, slugDe, description: desc, gb });

export const CATEGORIES: CategoryDef[] = [
  C('mcf-cat-pods', undefined, 'Pods', 'Kapseln', 'pods', 'kapseln', ['Coffee capsules compatible with Nespresso Original and Vertuo machines.', 'Kaffeekapseln, kompatibel mit Nespresso Original und Vertuo Maschinen.']),
  C('mcf-cat-pods-original', 'mcf-cat-pods', 'Original pods', 'Original Kapseln', 'original-pods', 'original-kapseln', ['Pods compatible with Nespresso Original machines.', 'Kapseln, kompatibel mit Nespresso Original Maschinen.']),
  C('mcf-cat-pods-vertuo', 'mcf-cat-pods', 'Vertuo pods', 'Vertuo Kapseln', 'vertuo-pods', 'vertuo-kapseln', ['Pods compatible with Nespresso Vertuo machines.', 'Kapseln, kompatibel mit Nespresso Vertuo Maschinen.']),
  C('mcf-cat-coffee', undefined, 'Coffee', 'Kaffee', 'coffee', 'kaffee', ['Whole bean and ground coffee.', 'Ganze Bohnen und gemahlener Kaffee.']),
  C('mcf-cat-coffee-beans', 'mcf-cat-coffee', 'Whole beans', 'Ganze Bohnen', 'whole-beans', 'ganze-bohnen', ['Freshly roasted whole beans.', 'Frisch geröstete ganze Bohnen.']),
  C('mcf-cat-coffee-ground', 'mcf-cat-coffee', 'Ground coffee', 'Gemahlener Kaffee', 'ground-coffee', 'gemahlener-kaffee', ['Ground for your brew method.', 'Gemahlen für Ihre Zubereitung.']),
  C('mcf-cat-coffee-single-origin', 'mcf-cat-coffee', 'Single origin', 'Single Origin', 'single-origin', 'single-origin', ['Coffees from one farm or region.', 'Kaffees von einer Farm oder Region.']),
  C('mcf-cat-coffee-blends', 'mcf-cat-coffee', 'Blends', 'Mischungen', 'blends', 'mischungen', ['Balanced house blends.', 'Ausgewogene Hausmischungen.']),
  C('mcf-cat-machines', undefined, 'Machines', 'Maschinen', 'machines', 'maschinen', ['Coffee machines and grinders.', 'Kaffeemaschinen und Mühlen.']),
  C('mcf-cat-machines-capsule', 'mcf-cat-machines', 'Capsule machines', 'Kapselmaschinen', 'capsule-machines', 'kapselmaschinen', ['Machines for Original and Vertuo capsules.', 'Maschinen für Original und Vertuo Kapseln.']),
  C('mcf-cat-machines-bean-to-cup', 'mcf-cat-machines', 'Bean to cup', 'Kaffeevollautomaten', 'bean-to-cup', 'kaffeevollautomaten', ['Grind and brew in one machine.', 'Mahlen und Brühen in einer Maschine.']),
  C('mcf-cat-machines-espresso', 'mcf-cat-machines', 'Espresso machines', 'Espressomaschinen', 'espresso-machines', 'espressomaschinen', ['Manual and lever espresso machines.', 'Manuelle und Hebel-Espressomaschinen.']),
  C('mcf-cat-machines-filter', 'mcf-cat-machines', 'Filter machines', 'Filtermaschinen', 'filter-machines', 'filtermaschinen', ['Drip filter coffee makers.', 'Filterkaffeemaschinen.']),
  C('mcf-cat-machines-grinders', 'mcf-cat-machines', 'Grinders', 'Kaffeemühlen', 'grinders', 'kaffeemuehlen', ['Burr grinders for fresh grounds.', 'Mahlwerke für frisches Kaffeepulver.']),
  C('mcf-cat-accessories', undefined, 'Accessories', 'Zubehör', 'accessories', 'zubehoer', ['Cups, frothers, care and storage.', 'Tassen, Milchaufschäumer, Pflege und Aufbewahrung.']),
  C('mcf-cat-accessories-cups-mugs', 'mcf-cat-accessories', 'Cups and mugs', 'Tassen und Becher', 'cups-and-mugs', 'tassen-und-becher', ['Cups and mugs for every brew.', 'Tassen und Becher für jede Zubereitung.']),
  C('mcf-cat-accessories-frothers', 'mcf-cat-accessories', 'Frothers', 'Milchaufschäumer', 'frothers', 'milchaufschaeumer', ['Milk frothers.', 'Milchaufschäumer.']),
  C('mcf-cat-accessories-care', 'mcf-cat-accessories', 'Care and descaling', 'Pflege und Entkalkung', 'care-and-descaling', 'pflege-und-entkalkung', ['Keep your machine in shape.', 'Halten Sie Ihre Maschine in Form.']),
  C('mcf-cat-accessories-storage', 'mcf-cat-accessories', 'Storage', 'Aufbewahrung', 'storage', 'aufbewahrung', ['Capsule and bean storage.', 'Aufbewahrung für Kapseln und Bohnen.']),
  C('mcf-cat-gifts', undefined, 'Gifts', 'Geschenke', 'gifts', 'geschenke', ['Curated gift sets.', 'Ausgesuchte Geschenksets.']),
];

export const categoryName = (c: CategoryDef): LString => ls(c.en, c.de, c.gb ?? c.en);

/** Order hints are strings between 0 and 1 that never end in 0. Position among its siblings. */
export function orderHint(c: CategoryDef): string {
  const siblings = CATEGORIES.filter((x) => x.parent === c.parent);
  return `0.${(siblings.indexOf(c) + 1) * 11}`;
}

export const categoryDrafts = (): CategoryDraft[] =>
  CATEGORIES.map((c) => ({
    key: c.key,
    name: categoryName(c),
    slug: { 'en-US': c.slugEn, 'en-GB': c.slugEn, 'de-DE': c.slugDe },
    description: ls(c.description[0], c.description[1]),
    orderHint: orderHint(c),
    ...(c.parent ? { parent: { typeId: 'category' as const, key: c.parent } } : {}),
  }));

export const categoryDepth = (key: string): number => {
  let depth = 0;
  for (let c = CATEGORIES.find((x) => x.key === key); c?.parent; c = CATEGORIES.find((x) => x.key === c?.parent)) depth += 1;
  return depth;
};
