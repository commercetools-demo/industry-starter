// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { CategoryDraft } from '@commercetools/platform-sdk';
import { ls, type LString } from './base';

/** Category tree (SEED-PLAN section 7). Parents come before children so references resolve. Slugs are unique per language. */
export interface CategoryDef {
  key: string;
  parent?: string;
  en: string;
  slugEn: string;
  description: string;
}

const C = (key: string, parent: string | undefined, en: string, slugEn: string, desc: string): CategoryDef =>
  ({ key, parent, en, slugEn, description: desc });

export const CATEGORIES: CategoryDef[] = [
  C('mcf-cat-pods', undefined, 'Pods', 'pods', 'Coffee capsules compatible with Nespresso Original and Vertuo machines.'),
  C('mcf-cat-pods-original', 'mcf-cat-pods', 'Original pods', 'original-pods', 'Pods compatible with Nespresso Original machines.'),
  C('mcf-cat-pods-vertuo', 'mcf-cat-pods', 'Vertuo pods', 'vertuo-pods', 'Pods compatible with Nespresso Vertuo machines.'),
  C('mcf-cat-coffee', undefined, 'Coffee', 'coffee', 'Whole bean and ground coffee.'),
  C('mcf-cat-coffee-beans', 'mcf-cat-coffee', 'Whole beans', 'whole-beans', 'Freshly roasted whole beans.'),
  C('mcf-cat-coffee-ground', 'mcf-cat-coffee', 'Ground coffee', 'ground-coffee', 'Ground for your brew method.'),
  C('mcf-cat-coffee-single-origin', 'mcf-cat-coffee', 'Single origin', 'single-origin', 'Coffees from one farm or region.'),
  C('mcf-cat-coffee-blends', 'mcf-cat-coffee', 'Blends', 'blends', 'Balanced house blends.'),
  C('mcf-cat-machines', undefined, 'Machines', 'machines', 'Coffee machines and grinders.'),
  C('mcf-cat-machines-capsule', 'mcf-cat-machines', 'Capsule machines', 'capsule-machines', 'Machines for Original and Vertuo capsules.'),
  C('mcf-cat-machines-bean-to-cup', 'mcf-cat-machines', 'Bean to cup', 'bean-to-cup', 'Grind and brew in one machine.'),
  C('mcf-cat-machines-espresso', 'mcf-cat-machines', 'Espresso machines', 'espresso-machines', 'Manual and lever espresso machines.'),
  C('mcf-cat-machines-filter', 'mcf-cat-machines', 'Filter machines', 'filter-machines', 'Drip filter coffee makers.'),
  C('mcf-cat-machines-grinders', 'mcf-cat-machines', 'Grinders', 'grinders', 'Burr grinders for fresh grounds.'),
  C('mcf-cat-accessories', undefined, 'Accessories', 'accessories', 'Cups, frothers, care and storage.'),
  C('mcf-cat-accessories-cups-mugs', 'mcf-cat-accessories', 'Cups and mugs', 'cups-and-mugs', 'Cups and mugs for every brew.'),
  C('mcf-cat-accessories-frothers', 'mcf-cat-accessories', 'Frothers', 'frothers', 'Milk frothers.'),
  C('mcf-cat-accessories-care', 'mcf-cat-accessories', 'Care and descaling', 'care-and-descaling', 'Keep your machine in shape.'),
  C('mcf-cat-accessories-storage', 'mcf-cat-accessories', 'Storage', 'storage', 'Capsule and bean storage.'),
  C('mcf-cat-gifts', undefined, 'Gifts', 'gifts', 'Curated gift sets.'),
];

export const categoryName = (c: CategoryDef): LString => ls(c.en);

/** Order hints are strings between 0 and 1 that never end in 0. Position among its siblings. */
export function orderHint(c: CategoryDef): string {
  const siblings = CATEGORIES.filter((x) => x.parent === c.parent);
  return `0.${(siblings.indexOf(c) + 1) * 11}`;
}

export const categoryDrafts = (): CategoryDraft[] =>
  CATEGORIES.map((c) => ({
    key: c.key,
    name: categoryName(c),
    slug: { 'en-US': c.slugEn, 'en-CA': c.slugEn },
    description: ls(c.description),
    orderHint: orderHint(c),
    ...(c.parent ? { parent: { typeId: 'category' as const, key: c.parent } } : {}),
  }));

export const categoryDepth = (key: string): number => {
  let depth = 0;
  for (let c = CATEGORIES.find((x) => x.key === key); c?.parent; c = CATEGORIES.find((x) => x.key === c?.parent)) depth += 1;
  return depth;
};
