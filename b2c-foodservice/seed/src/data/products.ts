// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { K, ls, slugify, type LString } from './base';

/**
 * The product definitions: about 40 products with their variants (SEED-PLAN section 8). Everything the drafts need is
 * derived from these rows (names, descriptions, attributes, prices, stock, reviews). Product names are invented; pods
 * are described as "compatible with Nespresso Original/Vertuo" and never carry the Nespresso brand as a name (D-005).
 */
export type ProductKind = 'pods' | 'coffee' | 'machine' | 'accessory' | 'gift';
export type ImageTag = 'capsule' | 'coffee' | 'machine' | 'cup';

export interface VariantDef {
  sku: string;
  /** One-time price in US cents (a multiple of 5); CAD is derived in prices.ts. */
  usd: number;
  attrs: Record<string, unknown>;
}

export interface ProductDef {
  /** Short upper-case code used in SKUs and as a handle in the data tables. */
  code: string;
  key: string;
  kind: ProductKind;
  name: LString;
  slug: LString;
  description: LString;
  categories: string[];
  productType: string;
  taxCategory: string;
  tag: ImageTag;
  subscribable: boolean;
  badge: 'none' | 'bestseller' | 'new' | 'limited-edition';
  /** Product-level attributes (the same on every variant). */
  common: Record<string, unknown>;
  variants: VariantDef[];
}

type Notes = string[];
const round5 = (n: number): number => Math.round(n / 5) * 5;
const list = (xs: string[], and: string): string => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} ${and} ${xs[xs.length - 1]}` : (xs[0] ?? ''));
const ltextNotes = (n: Notes): Record<string, string>[] => n.map((en) => ls(en));
const flag = (flags: string, c: string): boolean => flags.includes(c);

const roastWord: Record<string, string> = {
  light: 'light', medium: 'medium', 'medium-dark': 'medium-dark', dark: 'dark',
};
const certs = (flags: string): string => {
  const en = [flag(flags, 'D') ? 'decaffeinated' : '', flag(flags, 'O') ? 'organic' : '', flag(flags, 'F') ? 'Fairtrade' : ''].filter(Boolean);
  return en.length ? ` It is ${list(en, 'and')}.` : '';
};

// ---------------------------------------------------------------- pods
type PodRow = [code: string, name: string, system: 'original' | 'vertuo', intensity: number, roast: string, notes: Notes, origin: string, flags: string, badge: ProductDef['badge'], usd: number, sub: boolean];
const PODS: PodRow[] = [
  ['EMBER', 'Ember Ristretto', 'original', 12, 'dark', ['dark chocolate', 'toasted oak'], 'Brazil, Colombia', '', 'bestseller', 590, true],
  ['CASA', 'Casa Espresso', 'original', 8, 'medium', ['caramel', 'roasted hazelnut'], 'Colombia', '', 'none', 570, true],
  ['SUNRISE', 'Lungo Sunrise', 'original', 5, 'light', ['citrus', 'honey'], 'Ethiopia', '', 'new', 570, true],
  ['VELVET', 'Velvet Decaf', 'original', 6, 'medium', ['cocoa', 'almond'], 'Peru', 'D', 'none', 590, true],
  ['HAZEL', 'Hazelnut Dream', 'original', 7, 'medium', ['hazelnut', 'vanilla'], 'Brazil', '', 'limited-edition', 620, false],
  ['ANDES', 'Andes Organic', 'original', 9, 'medium-dark', ['red berries', 'dark cocoa'], 'Peru', 'OF', 'none', 650, true],
  ['ALBA', 'Alba Mug', 'vertuo', 4, 'light', ['floral', 'peach'], 'Kenya', '', 'none', 790, true],
  ['NOCTURNE', 'Nocturne Double Espresso', 'vertuo', 11, 'dark', ['black cherry', 'molasses'], 'Brazil, Guatemala', '', 'bestseller', 850, true],
  ['GRAN', 'Gran Lungo Reserve', 'vertuo', 8, 'medium-dark', ['toffee', 'walnut'], 'Colombia', '', 'none', 830, true],
  ['CLOUD', 'Vanilla Cloud', 'vertuo', 5, 'medium', ['vanilla', 'cream'], 'Brazil', '', 'new', 790, false],
  ['KILI', 'Kilimanjaro Single Origin', 'vertuo', 7, 'medium', ['blackcurrant', 'brown sugar'], 'Tanzania', 'F', 'none', 890, true],
  ['MORNING', 'Fairtrade Morning', 'vertuo', 6, 'medium', ['milk chocolate', 'hazelnut'], 'Honduras', 'F', 'none', 820, true],
];
const POD_PACKS: [number, number][] = [[10, 1], [50, 4.4], [100, 8]];

function podProduct(r: PodRow): ProductDef {
  const [code, name, system, intensity, roast, notes, origin, flags, badge, usd, sub] = r;
  const sys = system === 'original' ? 'Original' : 'Vertuo';
  const certEn = certs(flags);
  const rwEn = roastWord[roast] ?? 'medium';
  const en = (flavour: string) => `${name}: a ${rwEn} roast pod with intensity ${intensity} of 13 and ${flavour} notes of ${list(notes, 'and')}. Origin: ${origin}. Compatible with Nespresso ${sys} machines (not affiliated with Nespresso).${certEn}`;
  const common = {
    system, intensity, roast, flavourNotes: ltextNotes(notes), origin, decaf: flag(flags, 'D'), organic: flag(flags, 'O'), fairtrade: flag(flags, 'F'), badge, subscribable: sub,
  };
  return {
    code: `POD-${code}`, key: `mcf-p-${slugify(name)}`, kind: 'pods', name: ls(name), slug: ls(slugify(name)),
    description: { 'en-US': en('flavor'), 'en-CA': en('flavour') },
    categories: [`mcf-cat-pods-${system}`], productType: K.ptPods, taxCategory: K.taxFood, tag: 'capsule', subscribable: sub, badge, common,
    variants: POD_PACKS.map(([n, mult]) => ({ sku: `MCF-POD-${code}-${n}`, usd: round5(usd * mult), attrs: { capsulesPerPack: n } })),
  };
}

// ---------------------------------------------------------------- coffee
type CoffeeRow = [code: string, name: string, cat: 'single-origin' | 'blends', roast: string, origin: string, process: string, notes: Notes, intensity: number, flags: string, brew: string[], grind: string, badge: ProductDef['badge'], usd: number, sub: boolean];
const COFFEES: CoffeeRow[] = [
  ['YIRG', 'Ethiopia Yirgacheffe', 'single-origin', 'light', 'Ethiopia', 'Washed', ['jasmine', 'lemon'], 5, '', ['filter', 'french-press', 'cold-brew'], 'filter', 'new', 1695, true],
  ['HUILA', 'Colombia Huila', 'single-origin', 'medium', 'Colombia', 'Washed', ['red apple', 'caramel'], 6, '', ['filter', 'espresso', 'moka'], 'filter', 'none', 1595, true],
  ['SANTOS', 'Brazil Santos', 'single-origin', 'medium-dark', 'Brazil', 'Natural', ['peanut', 'milk chocolate'], 7, '', ['espresso', 'moka', 'french-press'], 'espresso', 'bestseller', 1495, true],
  ['ANTIGUA', 'Guatemala Antigua', 'single-origin', 'medium', 'Guatemala', 'Washed', ['cocoa', 'orange peel'], 7, '', ['filter', 'espresso'], 'filter', 'none', 1695, true],
  ['HOUSE', 'Malva House Blend', 'blends', 'medium', 'Brazil, Colombia', 'Washed and natural', ['hazelnut', 'brown sugar'], 6, '', ['filter', 'espresso', 'french-press'], 'filter', 'bestseller', 1395, true],
  ['ROMA', 'Espresso Roma', 'blends', 'dark', 'Brazil, Vietnam', 'Natural', ['dark chocolate', 'smoke'], 11, '', ['espresso', 'moka'], 'espresso', 'none', 1495, true],
  ['MORNFILTER', 'Morning Filter Blend', 'blends', 'light', 'Honduras, Colombia', 'Washed', ['stone fruit', 'honey'], 4, '', ['filter', 'cold-brew'], 'filter', 'none', 1395, true],
  ['DECAF', 'Swiss Water Decaf', 'blends', 'medium', 'Colombia', 'Swiss Water process', ['toffee', 'cocoa'], 5, 'D', ['filter', 'espresso'], 'filter', 'none', 1595, true],
  ['SUMATRA', 'Organic Sumatra', 'single-origin', 'dark', 'Indonesia', 'Wet-hulled', ['earthy', 'dark cocoa'], 9, 'OF', ['french-press', 'moka'], 'french-press', 'none', 1795, true],
  ['COLDBREW', 'Cold Brew Blend', 'blends', 'medium-dark', 'Brazil, Peru', 'Natural', ['black tea', 'dark fruit'], 6, '', ['cold-brew', 'french-press'], 'french-press', 'limited-edition', 1495, false],
];

function coffeeProduct(r: CoffeeRow): ProductDef {
  const [code, name, cat, roast, origin, process, notes, intensity, flags, brew, grind, badge, usd, sub] = r;
  const certEn = certs(flags);
  const rwEn = roastWord[roast] ?? 'medium';
  const en = (flavour: string) => `${name}: ${rwEn} roast coffee from ${origin} (${process.toLowerCase()}), intensity ${intensity} of 13, with ${flavour} notes of ${list(notes, 'and')}. Best brewed as ${list(brew, 'or')}.${certEn}`;
  const common = {
    roast, origin, process, flavourNotes: ltextNotes(notes), intensity, decaf: flag(flags, 'D'), organic: flag(flags, 'O'), fairtrade: flag(flags, 'F'), brewMethods: brew, badge, subscribable: sub,
  };
  const variants: VariantDef[] = [];
  for (const [grams, mult] of [[250, 1], [1000, 3.4]] as const) {
    for (const g of ['whole-bean', grind]) {
      variants.push({ sku: `MCF-COF-${code}-${grams === 250 ? '250' : '1K'}-${g === 'whole-bean' ? 'WB' : g.slice(0, 3).toUpperCase()}`, usd: round5(usd * mult), attrs: { sizeGrams: grams, grind: g } });
    }
  }
  return {
    code: `COF-${code}`, key: `mcf-p-${slugify(name)}`, kind: 'coffee', name: ls(name), slug: ls(slugify(name)),
    description: { 'en-US': en('flavor'), 'en-CA': en('flavour') },
    categories: ['mcf-cat-coffee-beans', 'mcf-cat-coffee-ground', `mcf-cat-coffee-${cat}`], productType: K.ptCoffee, taxCategory: K.taxFood, tag: 'coffee', subscribable: sub, badge, common, variants,
  };
}

// ---------------------------------------------------------------- machines
type MachineRow = [code: string, name: string, system: string, cat: string, pressure: number, tank: number, watts: number, features: string[], colours: string[], starter: boolean, usd: number, badge: ProductDef['badge']];
const MACHINES: MachineRow[] = [
  ['POD1', 'Pod One', 'original', 'capsule', 19, 600, 1260, ['Heats up in 25 seconds', 'Automatic power-off'], ['black', 'red'], true, 12900, 'bestseller'],
  ['PODPLUS', 'Pod Plus Milk', 'original', 'capsule', 19, 1000, 1500, ['Built-in milk frother', 'Programmable cup sizes'], ['white', 'black'], true, 21900, 'new'],
  ['VERTUO', 'Vertuo Studio', 'vertuo', 'capsule', 0, 1100, 1350, ['Barcode brewing', 'Five cup sizes'], ['black', 'cream'], true, 15900, 'none'],
  ['B2C1', 'Barista Pro Bean to Cup', 'bean-to-cup', 'bean-to-cup', 15, 1800, 1450, ['Conical burr grinder', 'Automatic milk system', 'Touch display'], ['silver', 'black'], false, 64900, 'none'],
  ['B2C2', 'Barista Compact', 'bean-to-cup', 'bean-to-cup', 15, 1400, 1350, ['Integrated grinder', 'Manual steam wand'], ['black', 'white'], false, 39900, 'none'],
  ['LEVER', 'Lever Espresso 15', 'espresso', 'espresso', 15, 1200, 1350, ['Dual boiler', 'Pressure gauge'], ['silver', 'red'], false, 29900, 'none'],
  ['DRIP', 'Drip Filter 10', 'filter', 'filter', 0, 1250, 1000, ['10 cup glass carafe', 'Programmable timer'], ['black', 'white'], false, 7900, 'none'],
  ['GRIND', 'Burr Grinder Conical', 'grinder', 'grinders', 0, 0, 150, ['40 grind settings', 'Anti-static container'], ['black', 'silver'], false, 12900, 'none'],
];

function machineProduct(r: MachineRow): ProductDef {
  const [code, name, system, cat, pressure, tank, watts, features, colours, starter, usd, badge] = r;
  const en = (colour: string) => `${name}: ${system === 'grinder' ? 'a burr grinder' : `a ${system.replace('-', ' ')} coffee machine`}${pressure ? ` with ${pressure} bar pressure` : ''}${tank ? ` and a ${tank} ml water tank` : ''}. ${list(features, 'and')}. ${colour === 'colour' ? 'Colour' : 'Color'} options: ${colours.join(' and ')}.`;
  const common: Record<string, unknown> = { system, powerWatts: watts, features, warrantyMonths: 24, badge: badge, subscribable: false };
  if (pressure) common.pressureBar = pressure;
  if (tank) common.waterTankMl = tank;
  const variants: VariantDef[] = [];
  for (const c of colours) {
    for (const b of starter ? ['machine-only', 'starter-capsules'] : ['machine-only']) {
      variants.push({ sku: `MCF-MAC-${code}-${c.slice(0, 3).toUpperCase()}-${b === 'machine-only' ? 'M' : 'S'}`, usd: usd + (b === 'starter-capsules' ? 2490 : 0), attrs: { colour: c, bundle: b } });
    }
  }
  return {
    code: `MAC-${code}`, key: `mcf-p-${slugify(name)}`, kind: 'machine', name: ls(name), slug: ls(slugify(name)),
    description: { 'en-US': en('color'), 'en-CA': en('colour') },
    categories: [`mcf-cat-machines-${cat}`], productType: K.ptMachine, taxCategory: K.taxStandard, tag: 'machine', subscribable: false, badge, common, variants,
  };
}

// ---------------------------------------------------------------- accessories
type AccessoryRow = [code: string, name: string, kind: string, material: string, capacity: number, cat: string, colours: string[], usd: number];
const ACCESSORIES: AccessoryRow[] = [
  ['GLASS', 'Double-wall glass cups (set of 2)', 'cup', 'Borosilicate glass', 80, 'cups-mugs', ['cream', 'black'], 2495],
  ['CERAMIC', 'Ceramic espresso cups (set of 4)', 'cup', 'Stoneware', 70, 'cups-mugs', ['white', 'red'], 2995],
  ['TRAVEL', 'Travel mug 350', 'mug', 'Stainless steel', 350, 'cups-mugs', ['black', 'silver'], 2495],
  ['FROTHER', 'Handheld milk frother', 'frother', 'Stainless steel', 0, 'frothers', ['black', 'silver'], 1495],
  ['DESCALE', 'Descaling kit (3 uses)', 'descaler', 'Citric acid formula', 300, 'care', ['white'], 1295],
  ['DRAWER', 'Capsule drawer (40 pods)', 'storage', 'Bamboo', 0, 'storage', ['cream', 'black'], 3495],
  ['CAROUSEL', 'Pod carousel holder', 'storage', 'Powder-coated steel', 0, 'storage', ['black', 'silver'], 2495],
  ['TAMPER', 'Tamper and distribution kit', 'grinder-accessory', 'Stainless steel and walnut', 0, 'care', ['silver'], 3995],
];

function accessoryProduct(r: AccessoryRow): ProductDef {
  const [code, name, kind, material, capacity, cat, colours, usd] = r;
  const en = (colour: string) => `${name}: ${material.toLowerCase()} ${kind.replace('-', ' ')}${capacity ? ` with ${capacity} ml capacity` : ''}. ${colour === 'colour' ? 'Colour' : 'Color'} options: ${colours.join(' and ')}.`;
  const common: Record<string, unknown> = { kind, material, badge: 'none', subscribable: false };
  if (capacity) common.capacityMl = capacity;
  return {
    code: `ACC-${code}`, key: `mcf-p-${slugify(name)}`, kind: 'accessory', name: ls(name), slug: ls(slugify(name)),
    description: { 'en-US': en('color'), 'en-CA': en('colour') },
    categories: [`mcf-cat-accessories-${cat}`], productType: K.ptAccessory, taxCategory: K.taxStandard, tag: 'cup', subscribable: false, badge: 'none', common,
    variants: colours.map((c) => ({ sku: `MCF-ACC-${code}-${c.slice(0, 3).toUpperCase()}`, usd, attrs: { colour: c } })),
  };
}

// ---------------------------------------------------------------- gifts
type GiftRow = [code: string, name: string, contents: string, occasion: string, usd: number, badge: ProductDef['badge']];
const GIFTS: GiftRow[] = [
  ['DISCOVERY', 'Pod Discovery Gift Set', 'Six sleeves of 10 pods compatible with Nespresso Original', 'discovery', 4995, 'new'],
  ['TASTING', 'Single Origin Tasting Box', 'Four 250 g single origin coffees, whole bean', 'thank-you', 5995, 'none'],
  ['STARTER', 'Pod One Starter Gift', 'Pod One machine in white, 50 pods compatible with Nespresso Original and two ceramic espresso cups', 'housewarming', 17900, 'none'],
];

function giftProduct(r: GiftRow): ProductDef {
  const [code, name, contents, occasion, usd, badge] = r;
  return {
    code: `GFT-${code}`, key: `mcf-p-${slugify(name)}`, kind: 'gift', name: ls(name), slug: ls(slugify(name)),
    description: ls(`${name}: ${contents}.`),
    categories: ['mcf-cat-gifts'], productType: K.ptGiftSet, taxCategory: K.taxStandard, tag: 'coffee', subscribable: false, badge,
    common: { contents: contents, occasion, badge, subscribable: false }, variants: [{ sku: `MCF-GFT-${code}`, usd, attrs: {} }],
  };
}

export const PRODUCTS: ProductDef[] = [
  ...PODS.map(podProduct), ...COFFEES.map(coffeeProduct), ...MACHINES.map(machineProduct), ...ACCESSORIES.map(accessoryProduct), ...GIFTS.map(giftProduct),
];

export const masterSku = (p: ProductDef): string => (p.variants[0] as VariantDef).sku;
export const productByCode = (code: string): ProductDef => {
  const p = PRODUCTS.find((x) => x.code === code);
  if (!p) throw new Error(`Unknown product code ${code}`);
  return p;
};
export const allVariants = (): { product: ProductDef; variant: VariantDef }[] => PRODUCTS.flatMap((product) => product.variants.map((variant) => ({ product, variant })));

/** Two bestsellers that are out of stock at one store while shipping stays available (fulfilment scenario "Collect at an empty store"). */
export const OUT_OF_STOCK_AT_STORE = { store: 'mcf-store-brooklyn-williamsburg', codes: ['POD-EMBER', 'MAC-POD1'] } as const;

/** Products with approved reviews and the number of reviews (3 to 12 each); every other product has none (empty state). */
export const REVIEW_COUNTS: Record<string, number> = {
  'POD-EMBER': 12, 'POD-NOCTURNE': 11, 'POD-CASA': 9, 'POD-ALBA': 7, 'POD-ANDES': 6, 'POD-SUNRISE': 5, 'POD-GRAN': 4, 'POD-KILI': 3,
  'COF-HOUSE': 12, 'COF-SANTOS': 10, 'COF-ROMA': 8, 'COF-YIRG': 7, 'COF-HUILA': 5, 'COF-SUMATRA': 4, 'COF-DECAF': 3,
  'MAC-POD1': 12, 'MAC-PODPLUS': 8, 'MAC-VERTUO': 6, 'MAC-B2C1': 5, 'MAC-B2C2': 4, 'MAC-DRIP': 3,
  'ACC-GLASS': 5, 'ACC-FROTHER': 4, 'ACC-CERAMIC': 3, 'GFT-DISCOVERY': 6,
};
