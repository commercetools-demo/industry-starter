// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { BrandKey, PositionKey, QualityKey } from './product-types';
import { fits } from './vehicles';

/**
 * The master catalog: SYNTHETIC parts with fictional brands. Part numbers follow `MLV-<2 letters>-<5 digits>` and are
 * not the prototype's. `eur` is the Malva list price in cents (the price a shopper pays when a reseller sets none).
 * `eur: null` is a pre-release part: configured, not priced ("Price pending", never 0).
 */
export interface PartDef {
  sku: string;
  de: string;
  en: string;
  cat: string; // "system/group"
  brand: BrandKey;
  tier: QualityKey;
  position?: PositionKey;
  eur: number | null;
  warranty: number;
  /** Fitment keys, or `'universal'`. */
  fit: string[] | 'universal';
  /** Synthetic OE cross references are generated from the SKU (see catalog.ts); none are real OE numbers. */
  core?: { eur: number; usd: number };
  recurring?: boolean;
  size?: string;
}

const golfA3Oct = [...fits('Volkswagen', 'Golf'), ...fits('Audi', 'A3'), ...fits('Skoda', 'Octavia')];
const golf7A3 = [...fits('Volkswagen', 'Golf', { generations: ['VII'] }), ...fits('Audi', 'A3')];
const bmwMerc = [...fits('BMW', '3 Series'), ...fits('Mercedes-Benz', 'C-Class')];
const usTrucks = [...fits('Ford', 'F-150'), ...fits('Chevrolet', 'Silverado 1500')];
const smallEu = [...fits('Opel', 'Astra'), ...fits('Ford', 'Focus'), ...fits('Renault', 'Clio')];
const tdi = [
  ...fits('Volkswagen', 'Golf', { engines: ['2.0 TDI'] }), ...fits('Audi', 'A3', { engines: ['2.0 TDI'] }), ...fits('Skoda', 'Octavia', { engines: ['2.0 TDI'] }),
];
const tsi = [
  ...fits('Volkswagen', 'Golf', { engines: ['1.4 TSI', '1.5 TSI'] }), ...fits('Audi', 'A3', { engines: ['1.4 TFSI'] }), ...fits('Skoda', 'Octavia', { engines: ['1.5 TSI'] }),
];

export const PARTS: PartDef[] = [
  // Brakes / pads
  { sku: 'MLV-BP-41001', de: 'Bremsbelagsatz vorn, Keramik', en: 'Front brake pad set, ceramic', cat: 'brakes/pads', brand: 'vektra', tier: 'premium', position: 'front', eur: 5490, warranty: 24, fit: golfA3Oct },
  { sku: 'MLV-BP-41002', de: 'Bremsbelagsatz hinten', en: 'Rear brake pad set', cat: 'brakes/pads', brand: 'vektra', tier: 'oes', position: 'rear', eur: 3990, warranty: 24, fit: golf7A3 },
  { sku: 'MLV-BP-41003', de: 'Bremsbelagsatz vorn, Economy', en: 'Front brake pad set, economy', cat: 'brakes/pads', brand: 'malva-select', tier: 'economy', position: 'front', eur: 2490, warranty: 12, fit: smallEu },
  { sku: 'MLV-BP-41004', de: 'Bremsbelagsatz vorn, Erstausrüster', en: 'Front brake pad set, original equipment', cat: 'brakes/pads', brand: 'vektra', tier: 'oem', position: 'front', eur: 7990, warranty: 36, fit: bmwMerc },
  { sku: 'MLV-BP-41005', de: 'Bremsbelagsatz vorn, Pick-up', en: 'Front brake pad set, pickup', cat: 'brakes/pads', brand: 'vektra', tier: 'premium', position: 'front', eur: 6990, warranty: 24, fit: usTrucks },
  { sku: 'MLV-BP-41099', de: 'Bremsbelagsatz vorn, Low-Dust (Vorserie)', en: 'Front brake pad set, low dust (pre-release)', cat: 'brakes/pads', brand: 'vektra', tier: 'premium', position: 'front', eur: null, warranty: 24, fit: fits('Volkswagen', 'Golf', { generations: ['VIII'] }) },
  // Brakes / discs
  { sku: 'MLV-BD-42001', de: 'Bremsscheibe vorn, belüftet', en: 'Front brake disc, vented', cat: 'brakes/discs', brand: 'vektra', tier: 'premium', position: 'front', eur: 4690, warranty: 24, fit: golfA3Oct, size: '312 x 25 mm' },
  { sku: 'MLV-BD-42002', de: 'Bremsscheibe hinten, voll', en: 'Rear brake disc, solid', cat: 'brakes/discs', brand: 'vektra', tier: 'premium', position: 'rear', eur: 2990, warranty: 24, fit: golf7A3, size: '253 x 10 mm' },
  { sku: 'MLV-BD-42003', de: 'Bremsscheibe vorn, belüftet, Erstausrüsterqualität', en: 'Front brake disc, vented, OE quality', cat: 'brakes/discs', brand: 'vektra', tier: 'oes', position: 'front', eur: 8990, warranty: 24, fit: bmwMerc, size: '300 x 22 mm' },
  { sku: 'MLV-BD-42004', de: 'Bremsscheibe vorn, Economy', en: 'Front brake disc, economy', cat: 'brakes/discs', brand: 'malva-select', tier: 'economy', position: 'front', eur: 4290, warranty: 12, fit: [...fits('Toyota', 'Camry'), ...fits('Toyota', 'Corolla')], size: '296 x 28 mm' },
  // Brakes / calipers
  { sku: 'MLV-BC-43001', de: 'Bremssattel vorn links, regeneriert', en: 'Front brake caliper left, remanufactured', cat: 'brakes/calipers', brand: 'vektra', tier: 'oem', position: 'left', eur: 18990, warranty: 24, fit: fits('Volkswagen', 'Golf', { generations: ['VII'] }), core: { eur: 4500, usd: 4900 } },
  { sku: 'MLV-BC-43002', de: 'Montagesatz Bremsbeläge', en: 'Brake pad fitting kit', cat: 'brakes/calipers', brand: 'malva-select', tier: 'economy', position: 'not-applicable', eur: 990, warranty: 12, fit: golfA3Oct },
  // Filters
  { sku: 'MLV-OF-44001', de: 'Ölfilter, Benziner', en: 'Oil filter, petrol', cat: 'filters/oil', brand: 'kestrel', tier: 'oes', eur: 1090, warranty: 12, fit: tsi, recurring: true },
  { sku: 'MLV-OF-44002', de: 'Ölfilter, Diesel', en: 'Oil filter, diesel', cat: 'filters/oil', brand: 'kestrel', tier: 'premium', eur: 1290, warranty: 12, fit: tdi, recurring: true },
  { sku: 'MLV-OF-44003', de: 'Ölfilter, Pick-up', en: 'Oil filter, pickup', cat: 'filters/oil', brand: 'kestrel', tier: 'premium', eur: 1190, warranty: 12, fit: usTrucks, recurring: true },
  { sku: 'MLV-OF-44004', de: 'Ölfilter, Economy', en: 'Oil filter, economy', cat: 'filters/oil', brand: 'malva-select', tier: 'economy', eur: 690, warranty: 12, fit: smallEu, recurring: true },
  { sku: 'MLV-AF-45001', de: 'Luftfilter', en: 'Air filter', cat: 'filters/air', brand: 'kestrel', tier: 'premium', eur: 1890, warranty: 12, fit: golf7A3, recurring: true },
  { sku: 'MLV-AF-45002', de: 'Luftfilter, Economy', en: 'Air filter, economy', cat: 'filters/air', brand: 'malva-select', tier: 'economy', eur: 1190, warranty: 12, fit: [...fits('Opel', 'Astra'), ...fits('Renault', 'Clio')], recurring: true },
  { sku: 'MLV-CF-46001', de: 'Innenraumfilter, Aktivkohle', en: 'Cabin filter, activated carbon', cat: 'filters/cabin', brand: 'kestrel', tier: 'premium', eur: 1990, warranty: 12, fit: [...golfA3Oct, ...fits('Ford', 'Focus')], recurring: true },
  { sku: 'MLV-CF-46002', de: 'Innenraumfilter, Pollen', en: 'Cabin filter, pollen', cat: 'filters/cabin', brand: 'malva-select', tier: 'economy', eur: 990, warranty: 12, fit: bmwMerc, recurring: true },
  { sku: 'MLV-FF-47001', de: 'Kraftstofffilter, Diesel', en: 'Fuel filter, diesel', cat: 'filters/fuel', brand: 'kestrel', tier: 'oes', eur: 2490, warranty: 12, fit: [...tdi, ...fits('Opel', 'Astra', { engines: ['1.6 CDTI'] }), ...fits('Renault', 'Clio', { engines: ['1.5 dCi'] })] },
  // Engine
  { sku: 'MLV-SP-48001', de: 'Zündkerzen, 4er-Satz', en: 'Spark plugs, set of 4', cat: 'engine/ignition', brand: 'voltaris', tier: 'premium', eur: 3290, warranty: 24, fit: tsi },
  { sku: 'MLV-SP-48002', de: 'Zündkerzen V8, 8er-Satz', en: 'Spark plugs V8, set of 8', cat: 'engine/ignition', brand: 'voltaris', tier: 'premium', eur: 4990, warranty: 24, fit: [...fits('Ford', 'F-150', { engines: ['5.0 V8'] }), ...fits('Chevrolet', 'Silverado 1500')] },
  { sku: 'MLV-TB-49001', de: 'Zahnriemensatz mit Wasserpumpe', en: 'Timing belt kit with water pump', cat: 'engine/belts', brand: 'rheinwerk', tier: 'oes', eur: 12990, warranty: 36, fit: tdi },
  { sku: 'MLV-RB-49002', de: 'Keilrippenriemen', en: 'Ribbed drive belt', cat: 'engine/belts', brand: 'rheinwerk', tier: 'premium', eur: 1890, warranty: 24, fit: [...fits('Opel', 'Astra'), ...fits('Ford', 'Focus')] },
  { sku: 'MLV-EM-50001', de: 'Motorlager rechts', en: 'Engine mount right', cat: 'engine/mounts', brand: 'alpendyn', tier: 'oem', position: 'right', eur: 6490, warranty: 24, fit: fits('Volkswagen', 'Golf', { generations: ['VII'] }) },
  // Suspension
  { sku: 'MLV-SA-51001', de: 'Stoßdämpfer vorn', en: 'Front shock absorber', cat: 'suspension/shocks', brand: 'alpendyn', tier: 'premium', position: 'front', eur: 8990, warranty: 24, fit: golfA3Oct },
  { sku: 'MLV-SA-51002', de: 'Stoßdämpfer hinten', en: 'Rear shock absorber', cat: 'suspension/shocks', brand: 'alpendyn', tier: 'premium', position: 'rear', eur: 6490, warranty: 24, fit: golf7A3 },
  { sku: 'MLV-SA-51003', de: 'Stoßdämpfer vorn, Pick-up', en: 'Front shock absorber, pickup', cat: 'suspension/shocks', brand: 'alpendyn', tier: 'economy', position: 'front', eur: 11990, warranty: 12, fit: fits('Ford', 'F-150') },
  { sku: 'MLV-CA-52001', de: 'Querlenker links', en: 'Control arm left', cat: 'suspension/arms', brand: 'alpendyn', tier: 'oes', position: 'left', eur: 7490, warranty: 24, fit: bmwMerc },
  { sku: 'MLV-CA-52002', de: 'Querlenker rechts', en: 'Control arm right', cat: 'suspension/arms', brand: 'alpendyn', tier: 'oes', position: 'right', eur: 7490, warranty: 24, fit: bmwMerc },
  { sku: 'MLV-WB-53001', de: 'Radlagersatz vorn', en: 'Front wheel bearing kit', cat: 'suspension/bearings', brand: 'alpendyn', tier: 'oem', position: 'front', eur: 6990, warranty: 36, fit: golf7A3 },
  // Electrical
  { sku: 'MLV-BT-54001', de: 'Starterbatterie 70 Ah', en: 'Starter battery 70 Ah', cat: 'electrical/batteries', brand: 'voltaris', tier: 'premium', eur: 12990, warranty: 36, fit: [...golfA3Oct, ...smallEu], core: { eur: 750, usd: 800 }, size: '70 Ah / 640 A' },
  { sku: 'MLV-BT-54002', de: 'Starterbatterie 95 Ah AGM', en: 'Starter battery 95 Ah AGM', cat: 'electrical/batteries', brand: 'voltaris', tier: 'oes', eur: 18990, warranty: 48, fit: [...usTrucks, ...fits('Toyota', 'Camry')], core: { eur: 750, usd: 800 }, size: '95 Ah / 850 A' },
  { sku: 'MLV-AL-55001', de: 'Lichtmaschine, regeneriert', en: 'Alternator, remanufactured', cat: 'electrical/charging', brand: 'voltaris', tier: 'oes', eur: 21990, warranty: 24, fit: [...fits('Volkswagen', 'Golf', { generations: ['VII'], engines: ['2.0 TDI'] }), ...fits('Audi', 'A3', { engines: ['2.0 TDI'] })], core: { eur: 5500, usd: 6000 }, size: '14 V / 140 A' },
  { sku: 'MLV-ST-55002', de: 'Anlasser, regeneriert', en: 'Starter motor, remanufactured', cat: 'electrical/charging', brand: 'voltaris', tier: 'oem', eur: 17990, warranty: 24, fit: fits('BMW', '3 Series', { engines: ['320d'] }), core: { eur: 4500, usd: 4900 } },
  { sku: 'MLV-HL-56001', de: 'H7 Halogenlampen, 2er-Set', en: 'H7 halogen bulbs, set of 2', cat: 'electrical/lighting', brand: 'nordlicht', tier: 'premium', eur: 1490, warranty: 12, fit: 'universal' },
  { sku: 'MLV-HL-56002', de: 'LED-Nebelscheinwerferlampen, 2er-Set', en: 'LED fog lamp bulbs, set of 2', cat: 'electrical/lighting', brand: 'nordlicht', tier: 'premium', eur: 2990, warranty: 12, fit: 'universal' },
  // Cooling
  { sku: 'MLV-WP-57001', de: 'Wasserpumpe', en: 'Water pump', cat: 'cooling/pumps', brand: 'rheinwerk', tier: 'oes', eur: 4290, warranty: 24, fit: tsi },
  { sku: 'MLV-RA-58001', de: 'Kühler', en: 'Radiator', cat: 'cooling/radiators', brand: 'rheinwerk', tier: 'premium', eur: 13990, warranty: 24, fit: [...fits('Opel', 'Astra'), ...fits('Ford', 'Focus')] },
  { sku: 'MLV-TH-59001', de: 'Thermostat', en: 'Thermostat', cat: 'cooling/thermostats', brand: 'rheinwerk', tier: 'oes', eur: 2490, warranty: 24, fit: [...fits('Volkswagen', 'Golf', { generations: ['VIII'] }), ...fits('Audi', 'A3')] },
  // Exhaust
  { sku: 'MLV-MU-60001', de: 'Endschalldämpfer', en: 'Rear muffler', cat: 'exhaust/mufflers', brand: 'malva-select', tier: 'economy', eur: 8990, warranty: 12, fit: fits('Opel', 'Astra') },
  { sku: 'MLV-LS-61001', de: 'Lambdasonde', en: 'Lambda sensor', cat: 'exhaust/sensors', brand: 'nordlicht', tier: 'oem', eur: 8490, warranty: 24, fit: tsi },
  // Fluids and care
  { sku: 'MLV-EO-62001', de: 'Motoröl 5W-30, 5 l', en: 'Engine oil 5W-30, 5 l', cat: 'care/oil', brand: 'kestrel', tier: 'premium', eur: 3990, warranty: 0, fit: 'universal', recurring: true, size: '5 l' },
  { sku: 'MLV-EO-62002', de: 'Motoröl 0W-20, 5 l', en: 'Engine oil 0W-20, 5 l', cat: 'care/oil', brand: 'kestrel', tier: 'premium', eur: 4590, warranty: 0, fit: 'universal', recurring: true, size: '5 l' },
  { sku: 'MLV-CO-63001', de: 'Kühlmittel G12+, 1,5 l', en: 'Coolant G12+, 1.5 l', cat: 'care/coolant', brand: 'malva-select', tier: 'economy', eur: 1190, warranty: 0, fit: 'universal', recurring: true, size: '1.5 l' },
  { sku: 'MLV-WW-64001', de: 'Scheibenwischer Flachbalken, Satz', en: 'Flat wiper blade set', cat: 'care/wipers', brand: 'nordlicht', tier: 'premium', eur: 1790, warranty: 12, fit: 'universal', recurring: true },
  { sku: 'MLV-WW-64002', de: 'Heckwischerblatt', en: 'Rear wiper blade', cat: 'care/wipers', brand: 'nordlicht', tier: 'economy', position: 'rear', eur: 890, warranty: 12, fit: [...fits('Volkswagen', 'Golf'), ...fits('Opel', 'Astra'), ...fits('Renault', 'Clio')], recurring: true },
];

/**
 * Seeded popularity (Q-L01, "Most popular" and the home block): 1 is the most popular, parts not listed are unranked
 * (the attribute is absent). 14 ranked parts, all carried by both resellers, so each store has a ranked top list.
 */
export const POPULARITY: Record<string, number> = {
  'MLV-BP-41001': 1, 'MLV-OF-44001': 2, 'MLV-EO-62001': 3, 'MLV-OF-44002': 4, 'MLV-WW-64001': 5, 'MLV-BT-54001': 6, 'MLV-AF-45001': 7,
  'MLV-CF-46001': 8, 'MLV-BD-42001': 9, 'MLV-EO-62002': 10, 'MLV-SP-48001': 11, 'MLV-BP-41002': 12, 'MLV-WW-64002': 13, 'MLV-CO-63001': 14,
};

/**
 * "Often bought together" (`related-skus`): 2 to 4 priced master parts of the same system (the next ones in list order,
 * wrapping), topped up from the following system when a system has fewer than 3 priced parts (exhaust has two). Never
 * the part itself, never a pre-release part.
 */
export function relatedSkus(sku: string): string[] {
  const priced = PARTS.filter((p) => p.eur !== null);
  const self = priced.find((p) => p.sku === sku);
  if (!self) return [];
  const system = self.cat.split('/')[0];
  const same = priced.filter((p) => p.cat.startsWith(`${system}/`));
  const i = same.findIndex((p) => p.sku === sku);
  const out: string[] = [];
  for (let step = 1; step < same.length && out.length < 3; step += 1) out.push(same[(i + step) % same.length]!.sku);
  if (out.length < 2) {
    const others = priced.filter((p) => !p.cat.startsWith(`${system}/`));
    const at = priced.indexOf(self);
    for (const p of [...priced.slice(at + 1), ...priced.slice(0, at)]) if (others.includes(p) && out.length < 2) out.push(p.sku);
  }
  return out;
}

export const partKey =(sku: string): string => `mau-part-${sku.toLowerCase()}`;
export const partBySku = (sku: string): PartDef => {
  const p = PARTS.find((x) => x.sku === sku);
  if (!p) throw new Error(`Unknown part ${sku}`);
  return p;
};

/** US-only parts: every fitment key belongs to a vehicle sold only in the US. */
export const isUsOnly = (p: PartDef): boolean =>
  p.fit !== 'universal' && p.fit.every((k) => /^(Ford\|F-150|Chevrolet\||Toyota\|Camry)/.test(k));
