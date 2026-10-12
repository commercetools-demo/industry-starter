// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { CategoryDraft } from '@commercetools/platform-sdk';
import { K, ls, slugify } from './base';

export interface GroupDef { slug: string; de: string; en: string }
export interface SystemDef { slug: string; de: string; en: string; groups: GroupDef[] }

/** 3 levels: root "Parts" > system > group. */
export const SYSTEMS: SystemDef[] = [
  { slug: 'brakes', de: 'Bremsen', en: 'Brakes', groups: [
    { slug: 'pads', de: 'Bremsbeläge', en: 'Brake pads' },
    { slug: 'discs', de: 'Bremsscheiben', en: 'Brake discs' },
    { slug: 'calipers', de: 'Bremssättel und Zubehör', en: 'Calipers and hardware' } ] },
  { slug: 'filters', de: 'Filter', en: 'Filters', groups: [
    { slug: 'oil', de: 'Ölfilter', en: 'Oil filters' },
    { slug: 'air', de: 'Luftfilter', en: 'Air filters' },
    { slug: 'cabin', de: 'Innenraumfilter', en: 'Cabin filters' },
    { slug: 'fuel', de: 'Kraftstofffilter', en: 'Fuel filters' } ] },
  { slug: 'engine', de: 'Motor', en: 'Engine', groups: [
    { slug: 'ignition', de: 'Zündung', en: 'Ignition' },
    { slug: 'belts', de: 'Riemen und Ketten', en: 'Belts and chains' },
    { slug: 'mounts', de: 'Motorlager', en: 'Engine mounts' } ] },
  { slug: 'suspension', de: 'Fahrwerk und Lenkung', en: 'Suspension and steering', groups: [
    { slug: 'shocks', de: 'Stoßdämpfer', en: 'Shock absorbers' },
    { slug: 'arms', de: 'Querlenker', en: 'Control arms' },
    { slug: 'bearings', de: 'Radlager', en: 'Wheel bearings' } ] },
  { slug: 'electrical', de: 'Elektrik und Licht', en: 'Electrical and lighting', groups: [
    { slug: 'batteries', de: 'Batterien', en: 'Batteries' },
    { slug: 'charging', de: 'Lichtmaschinen und Anlasser', en: 'Alternators and starters' },
    { slug: 'lighting', de: 'Beleuchtung', en: 'Lighting' } ] },
  { slug: 'cooling', de: 'Kühlung und Heizung', en: 'Cooling and heating', groups: [
    { slug: 'pumps', de: 'Wasserpumpen', en: 'Water pumps' },
    { slug: 'radiators', de: 'Kühler', en: 'Radiators' },
    { slug: 'thermostats', de: 'Thermostate', en: 'Thermostats' } ] },
  { slug: 'exhaust', de: 'Abgasanlage', en: 'Exhaust', groups: [
    { slug: 'mufflers', de: 'Schalldämpfer', en: 'Mufflers' },
    { slug: 'sensors', de: 'Lambdasonden', en: 'Lambda sensors' } ] },
  { slug: 'care', de: 'Flüssigkeiten und Pflege', en: 'Fluids and care', groups: [
    { slug: 'oil', de: 'Motoröl', en: 'Engine oil' },
    { slug: 'coolant', de: 'Kühlmittel', en: 'Coolant' },
    { slug: 'wipers', de: 'Wischerblätter', en: 'Wiper blades' } ] },
];

export const systemKey = (system: string): string => `mau-cat-${system}`;
export const groupKey = (system: string, group: string): string => `mau-cat-${system}-${group}`;
/** "brakes/pads" -> category key. */
export const categoryKeyOf = (path: string): string => {
  const [s, g] = path.split('/');
  return groupKey(s as string, g as string);
};

const hint = (i: number): string => `0.${String(i + 1).padStart(2, '0')}1`;

export const categoryDrafts: CategoryDraft[] = [
  { key: K.catRoot, name: ls('Ersatzteile', 'Parts'), slug: ls('ersatzteile', 'parts'), orderHint: '0.1' },
  ...SYSTEMS.flatMap((s, i) => [
    { key: systemKey(s.slug), name: ls(s.de, s.en), slug: ls(slugify(s.de), slugify(s.en)), parent: { typeId: 'category' as const, key: K.catRoot }, orderHint: hint(i) },
    ...s.groups.map((g, j) => ({
      key: groupKey(s.slug, g.slug), name: ls(g.de, g.en),
      // group slugs repeat across systems (oil, wipers), so the system slug is part of them.
      slug: ls(`${slugify(s.de)}-${slugify(g.de)}`, `${slugify(s.en)}-${slugify(g.en)}`),
      parent: { typeId: 'category' as const, key: systemKey(s.slug) }, orderHint: hint(j),
    })),
  ]),
];

export const ALL_GROUP_PATHS: string[] = SYSTEMS.flatMap((s) => s.groups.map((g) => `${s.slug}/${g.slug}`));
