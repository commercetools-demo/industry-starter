// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTRACT_KEYS, CONTRACT_TYPE_KEYS, K } from './data/base';
import { BLOCKED_UPSTREAM, WITHDRAWN, localReviewObjects, assortmentKeys, assortmentSkus, masterSkus } from './data/assortment';
import { allProductDrafts, partAttributes, partDraft } from './data/catalog';
import { ALL_GROUP_PATHS, SYSTEMS, categoryDrafts } from './data/categories';
import { defaultTheme, TAILORINGS, tailoringKey } from './data/content';
import { typeDrafts } from './data/custom-types';
import { PRODUCT_DISCOUNT_CHANNEL, cartDiscountDrafts, channelClause, discountCodeDrafts, productDiscountDrafts } from './data/discounts';
import { REVIEWS, reviewDrafts, reviewedSkus } from './data/reviews';
import { inventoryDrafts, recurrencePolicyDrafts } from './data/extras';
import { BUNDLES, LOCAL_PARTS, bundleEur, eurOf, keyOfSku } from './data/items';
import { BRANCHES, BUSINESS_UNITS, CUSTOMERS, STORES, channelDrafts, roleDrafts, storeDrafts } from './data/org';
import { PARTS, POPULARITY, relatedSkus } from './data/parts';
import { baseKey, isSeedPriceKey, priceDefs, standalonePriceDrafts } from './data/prices';
import { retailFactor, usdFromEur } from './data/pricing';
import { BRANDS, partAttributes as partAttrDefs, productTypeDrafts } from './data/product-types';
import { stateDrafts } from './data/states';
import { OWNED_CONTAINERS } from './data/base';
import { businessUnitDraft, customerDraft, garageJson, tailoringDraft } from './drafts';
import { shippingMethodDrafts, taxCategoryDraft, zoneDrafts } from './data/tax-shipping';
import { VEHICLES, findFitmentKey } from './data/vehicles';
import { isCleanUrl } from './lib';

const dataDir = new URL('./data/', import.meta.url);
const dataFiles = ['assortment', 'base', 'catalog', 'categories', 'content', 'custom-types', 'discounts', 'extras', 'items', 'org', 'parts', 'prices', 'pricing', 'product-types', 'reviews', 'states', 'tax-shipping', 'vehicles'];

describe('no prototype placeholders leak into seed data', () => {
  const banned = [/Auto[l]ine/i, /Hart[m]ann/i, /Northline/i, /Lakeshore/i, /Harbour/i, /Maple Ridge/i, /Honda Civic/i, /Brembo/i, /\bBosch\b/i, /\bDenso\b/i, /\bMobil\b/i, /BP-2210-C/, /MLV-(OF-20233|BD-31201|AL-70441|WB-90015|SP-50108|BP-11874|TB-40517|SA-62290|HL-81120|EV-99001|CV-33102)/, /Toronto/i, /\bCAD\b/];
  const everything = [
    ...dataFiles.map((f) => readFileSync(new URL(`${f}.ts`, dataDir), 'utf8')),
    JSON.stringify([allProductDrafts(), categoryDrafts, storeDrafts(), channelDrafts, BUSINESS_UNITS, CUSTOMERS, productDiscountDrafts, cartDiscountDrafts, typeDrafts]),
  ].join('\n');
  it.each(banned.map((b) => [String(b), b] as const))('does not contain %s', (_n, re) => {
    expect(everything).not.toMatch(re);
  });
});

describe('keys and names', () => {
  it('every seed key starts with mau-', () => {
    const keys = [
      ...categoryDrafts.map((c) => c.key), ...productTypeDrafts.map((p) => p.key), ...typeDrafts.map((t) => t.key), ...channelDrafts.map((c) => c.key),
      ...storeDrafts().map((s) => s.key), ...roleDrafts.map((r) => r.key), ...BUSINESS_UNITS.map((b) => b.key), ...CUSTOMERS.map((c) => c.key),
      ...allProductDrafts().map((p) => p.key), ...inventoryDrafts().map((i) => i.key), ...productDiscountDrafts.map((d) => d.key), ...cartDiscountDrafts.map((d) => d.key),
      ...discountCodeDrafts.map((d) => d.key), ...recurrencePolicyDrafts.map((r) => r.key), ...shippingMethodDrafts.map((s) => s.key), ...zoneDrafts.map((z) => z.key),
      taxCategoryDraft.key, ...stateDrafts.map((s) => s.key), ...OWNED_CONTAINERS,
    ];
    // Only the contract keys other workstreams hard-code (custom types, order state) may lack the prefix.
    expect(keys.filter((k) => !k?.startsWith('mau-') && !CONTRACT_KEYS.includes(k as string))).toEqual([]);
    expect(CONTRACT_KEYS.every((k) => typeDrafts.some((t) => t.key === k) || stateDrafts.some((s) => s.key === k))).toBe(true);
  });

  it('standalone price keys follow the scheme and are unique', () => {
    const drafts = standalonePriceDrafts();
    expect(new Set(drafts.map((d) => d.key)).size).toBe(drafts.length);
    for (const d of drafts) expect(isSeedPriceKey(d.key as string, d.sku)).toBe(true);
    expect(isSeedPriceKey('air-filter__base-eur-de', 'air-filter')).toBe(false); // a sample SKU is never seed owned
    expect(isSeedPriceKey('MLV-BP-41001__something-else', 'MLV-BP-41001')).toBe(false);
  });

  it('keys and SKUs are unique', () => {
    const all = [...allProductDrafts().map((p) => p.key), ...inventoryDrafts().map((i) => i.key), ...categoryDrafts.map((c) => c.key), ...BUSINESS_UNITS.map((b) => b.key)];
    expect(new Set(all).size).toBe(all.length);
    const skus = allProductDrafts().map((p) => p.masterVariant?.sku);
    expect(new Set(skus).size).toBe(skus.length);
  });

  it('slugs are unique per language and every name exists in de-DE and en-US', () => {
    for (const lang of ['de-DE', 'en-US']) {
      const slugs = [...allProductDrafts().map((p) => p.slug?.[lang]), ...categoryDrafts.map((c) => c.slug?.[lang])];
      expect(new Set(slugs).size).toBe(slugs.length);
      expect(slugs.every((s) => s && /^[a-z0-9-]+$/.test(s))).toBe(true);
    }
    for (const d of [...allProductDrafts(), ...categoryDrafts]) {
      expect(d.name?.['de-DE']).toBeTruthy();
      expect(d.name?.['en-US']).toBeTruthy();
    }
  });

  it('demo customers use example.com', () => {
    expect(CUSTOMERS.every((c) => c.email.endsWith('@example.com'))).toBe(true);
  });
});

describe('categories', () => {
  it('has 8 systems, 3 levels and the groups of each system', () => {
    expect(SYSTEMS).toHaveLength(8);
    expect(categoryDrafts).toHaveLength(1 + SYSTEMS.length + ALL_GROUP_PATHS.length);
    const parentOf = new Map(categoryDrafts.map((c) => [c.key, (c.parent as { key?: string } | undefined)?.key]));
    const depth = (k: string): number => (parentOf.get(k) ? 1 + depth(parentOf.get(k) as string) : 1);
    expect(Math.max(...categoryDrafts.map((c) => depth(c.key as string)))).toBe(3);
    for (const c of categoryDrafts) if (c.parent) expect(parentOf.has((c.parent as { key: string }).key)).toBe(true);
  });
});

describe('parts', () => {
  it('has about 40 parts over several brands, tiers and every system', () => {
    expect(PARTS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(PARTS.map((p) => p.brand)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(PARTS.map((p) => p.tier))).toEqual(new Set(['oem', 'oes', 'premium', 'economy']));
    for (const s of SYSTEMS) expect(PARTS.some((p) => p.cat.startsWith(`${s.slug}/`))).toBe(true);
    for (const g of ALL_GROUP_PATHS) expect(PARTS.some((p) => p.cat === g)).toBe(true);
    expect(PARTS.every((p) => BRANDS.some((b) => b.key === p.brand))).toBe(true);
  });

  it('models fitment as YEAR RANGES in flat searchable text that exists in the vehicle table (Q-J03)', () => {
    const known = new Set(VEHICLES.map((v) => v.fitmentKey));
    for (const p of PARTS) {
      if (p.fit === 'universal') continue;
      expect(p.fit.length).toBeGreaterThan(0);
      for (const k of p.fit) {
        expect(known.has(k)).toBe(true);
        const [make, model, from, to, engine] = k.split('|');
        expect(k.split('|')).toHaveLength(5); // make|model|year-from|year-to|engine
        expect(make && model && engine).toBeTruthy();
        expect(Number(from)).toBeLessThanOrEqual(Number(to)); // a range, never one explicit year id
      }
    }
    // the vehicle records carry the range, not one record per year
    expect(VEHICLES.every((v) => v.yearTo > v.yearFrom)).toBe(true);
    expect(VEHICLES).toHaveLength(26);
    const def = partAttrDefs.find((a) => a.name === 'fitment-keys');
    expect(def?.isSearchable).toBe(true);
    expect(def?.type).toEqual({ name: 'set', elementType: { name: 'text' } });
    expect(findFitmentKey('Volkswagen', 'Golf', 2016, '2.0 TDI')).toBe('Volkswagen|Golf|2012|2019|2.0 TDI');
    expect(findFitmentKey('Volkswagen', 'Golf', 1999, '2.0 TDI')).toBeUndefined();
  });

  it('carries quality tier, brand, warranty, OE number and searchable attributes, and no MAP floor', () => {
    const p = PARTS[0]!;
    const names = partAttributes(p).map((a) => a.name);
    for (const n of ['brand', 'quality-tier', 'warranty-months', 'oem-numbers', 'part-number', 'fitment-keys', 'recurring-eligible']) expect(names).toContain(n);
    expect(names).not.toContain('map-floor-percent');
    expect(partAttrDefs.some((a) => a.name === 'map-floor-percent')).toBe(false);
    for (const n of ['brand', 'quality-tier', 'part-number', 'oem-numbers', 'position', 'universal-fit', 'recurring-eligible']) expect(partAttrDefs.find((a) => a.name === n)?.isSearchable).toBe(true);
    expect(PARTS.filter((x) => x.core).length).toBeGreaterThanOrEqual(3);
  });

  it('flags subscribable parts (Q-Q06): oil filters, wiper blades and cabin filters among them', () => {
    const sub = PARTS.filter((x) => x.recurring);
    expect(sub.length).toBeGreaterThanOrEqual(8);
    for (const group of ['filters/oil', 'filters/cabin', 'care/wipers']) expect(sub.some((x) => x.cat === group)).toBe(true);
    expect(partAttributes(sub[0]!).find((a) => a.name === 'recurring-eligible')?.value).toBe(true);
    expect(partAttributes(PARTS.find((x) => !x.recurring)!).find((a) => a.name === 'recurring-eligible')?.value).toBe(false);
  });

  it('has exactly one pre-release part without any price, embedded or standalone', () => {
    const pre = PARTS.filter((p) => p.eur === null);
    expect(pre).toHaveLength(1);
    expect(priceDefs().some((d) => d.sku === pre[0]!.sku)).toBe(false);
  });

  it('local parts have no fitment attribute (they cannot claim compatibility)', () => {
    const local = allProductDrafts().filter((d) => d.key?.startsWith('mau-local-'));
    expect(local.length).toBe(LOCAL_PARTS.length);
    for (const d of local) expect(d.masterVariant?.attributes?.some((a) => a.name === 'fitment-keys')).toBe(false);
    expect(productTypeDrafts.find((t) => t.key === K.ptLocalPart)?.attributes?.some((a) => a.name === 'fitment-keys')).toBe(false);
  });
});

describe('prices (all standalone, Q-003; no floor, Q-T03; no wholesale tiers, Q-V01)', () => {
  const defs = priceDefs();
  const scope = (d: { channelKey?: string }) => (d.channelKey ? 'channel' : 'base');

  it('products carry no embedded price and are in standalone price mode', () => {
    for (const d of allProductDrafts()) {
      expect(d.priceMode).toBe('Standalone');
      expect((d.masterVariant as { prices?: unknown[] }).prices).toBeUndefined();
    }
  });

  it('gives every priced master part an EUR/DE and a USD/US Malva base price without channel, group or tiers', () => {
    for (const part of PARTS.filter((x) => x.eur !== null)) {
      const base = defs.filter((d) => d.sku === part.sku && scope(d) === 'base');
      expect(base.map((d) => `${d.currency}/${d.country}`).sort()).toEqual(['EUR/DE', 'USD/US']);
      expect(base.find((d) => d.currency === 'EUR')?.cents).toBe(part.eur);
      expect(base.find((d) => d.currency === 'USD')?.cents).toBe(usdFromEur(part.eur as number));
    }
    for (const d of standalonePriceDrafts()) {
      expect(d).not.toHaveProperty('customerGroup');
      expect(d).not.toHaveProperty('tiers');
    }
    expect(baseKey('MLV-BP-41001', 'EUR')).toBe('MLV-BP-41001__base-eur-de');
  });

  it('puts reseller retail prices on the store distribution channel and keeps every price a whole number of cents above zero', () => {
    expect(defs.every((d) => Number.isInteger(d.cents) && d.cents > 0)).toBe(true);
    const channelSkus = (ch: string) => defs.filter((d) => d.channelKey === ch && d.currency === 'EUR').map((d) => d.sku);
    expect(channelSkus(K.distNorth).length).toBeGreaterThan(5);
    expect(channelSkus(K.distSouth).length).toBeGreaterThan(5);
    expect(channelSkus(K.distNorth)).not.toEqual(channelSkus(K.distSouth));
    expect(defs.some((d) => d.channelKey === K.distSouth && d.currency === 'USD' && d.country === 'US')).toBe(true);
    expect(defs.filter((d) => d.channelKey === K.distNorth).every((d) => d.currency === 'EUR')).toBe(true);
  });

  it('has no price floor: retail prices below 88 % of the base price are legal and present', () => {
    const base = new Map(defs.filter((d) => !d.channelKey && d.currency === 'EUR').map((d) => [d.sku, d.cents]));
    const below = defs.filter((d) => d.channelKey && d.currency === 'EUR' && base.has(d.sku) && d.cents < (base.get(d.sku) as number) * 0.88);
    expect(below.length).toBeGreaterThan(0);
    expect(retailFactor(K.distNorth, 3)).toBeLessThan(0.88);
  });

  it('reseller-owned items (local parts, own bundles) are priced on the owner channel only', () => {
    for (const l of LOCAL_PARTS) {
      const own = defs.filter((d) => d.sku === l.sku);
      expect(own.some((d) => !d.channelKey)).toBe(false);
      expect(own.find((d) => d.channelKey === (l.owner === K.storeNorth ? K.distNorth : K.distSouth) && d.currency === 'EUR')?.cents).toBe(l.eur);
    }
    expect(defs.some((d) => d.sku === 'KW-KIT-1101' && d.channelKey === K.distNorth)).toBe(true);
    expect(defs.some((d) => d.sku === 'KW-KIT-1101' && !d.channelKey)).toBe(false);
  });

  it('lets branch channels carry their own prices in the branch currency (Q-005)', () => {
    const branchPrices = defs.filter((d) => d.channelKey?.startsWith('mau-br-'));
    expect(branchPrices.length).toBeGreaterThan(10);
    for (const d of branchPrices) {
      const b = BRANCHES.find((x) => x.key === d.channelKey)!;
      expect(d.currency).toBe(b.country === 'DE' ? 'EUR' : 'USD');
      expect(assortmentSkus(b.store)).toContain(d.sku);
    }
    expect(new Set(branchPrices.map((d) => d.channelKey)).size).toBeGreaterThan(3);
    const channels = new Map(channelDrafts.map((c) => [c.key, c]));
    for (const b of BRANCHES) expect(channels.get(b.key)?.roles).toEqual(['InventorySupply', 'ProductDistribution']);
  });
});

describe('bundles', () => {
  it('lists components that exist and prices at the discounted components total', () => {
    for (const b of BUNDLES) {
      for (const c of b.components) expect(() => eurOf(c.sku)).not.toThrow();
      const total = b.components.reduce((s, c) => s + eurOf(c.sku) * c.qty, 0);
      expect(bundleEur(b)).toBeLessThan(total);
      expect(bundleEur(b)).toBeGreaterThan(0);
    }
  });
});

describe('assortment per reseller', () => {
  const north = new Set(assortmentSkus(K.storeNorth));
  const south = new Set(assortmentSkus(K.storeSouth));

  it('differs between the two resellers and is a subset of what Malva sells (plus own local items)', () => {
    expect(north.size).toBeGreaterThan(20);
    expect(south.size).toBeGreaterThan(20);
    expect([...north].sort()).not.toEqual([...south].sort());
    const master = new Set(masterSkus());
    for (const sku of [...north, ...south]) expect(master.has(sku) || LOCAL_PARTS.some((l) => l.sku === sku) || BUNDLES.some((b) => b.sku === sku)).toBe(true);
  });

  it('excludes blocked, withdrawn, pre-release and pending-review items, and other resellers local items', () => {
    for (const b of BLOCKED_UPSTREAM) expect(north.has(b.sku) || south.has(b.sku)).toBe(false);
    for (const w of WITHDRAWN[K.storeNorth] ?? []) expect(north.has(w.sku)).toBe(false);
    for (const w of WITHDRAWN[K.storeSouth] ?? []) expect(south.has(w.sku)).toBe(false);
    expect(north.has('MLV-BP-41099') || south.has('MLV-BP-41099')).toBe(false);
    expect(south.has('SK-2002')).toBe(false);
    expect(north.has('SK-2001') || south.has('KW-1001')).toBe(false);
    expect(north.has('KW-1001')).toBe(true);
    expect(south.has('SK-2001')).toBe(true);
  });

  it('hides a bundle whose component is withdrawn (design: bundle rules)', () => {
    expect(north.has('MLV-KIT-71002')).toBe(true);
    expect(south.has('MLV-KIT-71002')).toBe(false); // fuel filter withdrawn in south
    expect(north.has('KW-KIT-1101')).toBe(true);
    expect(south.has('KW-KIT-1101')).toBe(false);
  });

  it('keeps US-only parts out of north and in south', () => {
    expect(north.has('MLV-BP-41005')).toBe(false);
    expect(south.has('MLV-BP-41005')).toBe(true);
  });

  it('every selection key is a seeded product', () => {
    const keys = new Set(allProductDrafts().map((p) => p.key));
    for (const k of [...assortmentKeys(K.storeNorth), ...assortmentKeys(K.storeSouth)]) expect(keys.has(k)).toBe(true);
    expect(keyOfSku('MLV-BP-41001')).toBe('mau-part-mlv-bp-41001');
  });
});

describe('stores, branches and people', () => {
  it('has two reseller stores with their own branches, distribution channel and warehouse', () => {
    expect(STORES.map((s) => s.key)).toEqual([K.storeNorth, K.storeSouth]);
    expect(storeDrafts().map((s) => s.key)).toEqual([K.storeNorth, K.storeSouth]); // no wholesale store (Q-V01)
    for (const s of storeDrafts()) {
      // the retail channel plus the branches (a branch carries stock and prices, Q-005)
      expect((s.distributionChannels ?? []).length).toBeGreaterThanOrEqual(4);
      expect((s.supplyChannels ?? []).length).toBeGreaterThanOrEqual(4);
      expect(s.languages).toEqual(['de-DE', 'en-US']);
    }
    expect(BRANCHES.filter((b) => b.store === K.storeNorth).length).toBeGreaterThanOrEqual(3);
    for (const b of BRANCHES) {
      // branch-info.openingHours: { mon: ["08:00","20:00"], ... }, a missing day means closed
      const days = Object.keys(b.hours);
      expect(days).toContain('mon');
      expect(days).not.toContain('sun');
      for (const [open, close] of Object.values(b.hours)) expect(open < close).toBe(true);
      expect(['same-day', 'next-day', 'ship-to-store']).toContain(b.pickup);
      expect(b.lat).toBeGreaterThan(-90);
    }
  });

  it('has store countries as information only: no territory data is seeded (Q-O03)', () => {
    for (const s of storeDrafts()) expect(JSON.stringify(s.custom)).not.toMatch(/territor/i);
    expect(JSON.stringify(typeDrafts)).not.toMatch(/territor/i);
    expect(JSON.stringify(BUSINESS_UNITS)).not.toMatch(/territor/i);
    expect(storeDrafts().find((s) => s.key === K.storeNorth)?.countries).toEqual([{ code: 'DE' }]);
    expect(storeDrafts().find((s) => s.key === K.storeSouth)?.countries).toEqual([{ code: 'DE' }, { code: 'US' }]);
  });

  it('writes the store settings and branch contract fields the storefront and portal read', () => {
    const t = Object.fromEntries(typeDrafts.map((x) => [x.key, x]));
    const store = storeDrafts()[0]!;
    const fields = (store.custom as { fields: Record<string, unknown> }).fields;
    const defined = new Set(t[CONTRACT_TYPE_KEYS.storeSettings]?.fieldDefinitions?.map((f) => f.name));
    for (const f of Object.keys(fields)) expect(defined.has(f)).toBe(true);
    for (const f of ['logoUrl', 'faviconUrl', 'freeShippingThresholdCent', 'shipDaysMin', 'shipDaysMax', 'timezone', 'helpUrl', 'trackUrl', 'returnWindowDays', 'addressLine', 'postalCode', 'city', 'countryCode', 'latitude', 'longitude']) expect(defined.has(f)).toBe(true);
    expect(fields.returnWindowDays).toBe(30);
    const branch = channelDrafts.find((c) => c.key === 'mau-br-north-hamburg')!;
    const bf = (branch.custom as { fields: Record<string, unknown> }).fields;
    const bdefined = new Set(t[CONTRACT_TYPE_KEYS.branchInfo]?.fieldDefinitions?.map((f) => f.name));
    for (const f of Object.keys(bf)) expect(bdefined.has(f)).toBe(true);
    expect(JSON.parse(bf.openingHours as string).mon).toEqual(['08:00', '19:00']);
    expect(bf.pickupMode).toBe('same-day');
  });

  it('has Admin and Buyer roles (reseller portal staff) with valid platform permissions; no approver, quote or approval permission', () => {
    expect(roleDrafts.map((r) => r.name)).toEqual(['Admin', 'Buyer']);
    const d = readFileSync(new URL('../node_modules/@commercetools/platform-sdk/dist/declarations/src/generated/models/associate-role.d.ts', import.meta.url), 'utf8');
    const union = d.match(/export type Permission = ([^;]+);/)?.[1] ?? '';
    const valid = new Set([...union.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]));
    expect(valid.size).toBeGreaterThan(30);
    for (const r of roleDrafts) for (const perm of r.permissions ?? []) expect(valid.has(perm)).toBe(true);
    const by = (k: string) => new Set(roleDrafts.find((r) => r.name === k)?.permissions);
    for (const r of roleDrafts) expect((r.permissions ?? []).some((x) => /Approval|Quote/.test(x))).toBe(false);
    expect(by('Admin').has('UpdateAssociates')).toBe(true);
    expect(by('Buyer').has('UpdateAssociates')).toBe(false);
  });

  it('builds the authority chain Malva Global > DACH > reseller > branches and gives every associate a customer', () => {
    const byKey = new Map(BUSINESS_UNITS.map((b) => [b.key, b]));
    for (const b of BUSINESS_UNITS) if (b.parent) expect(BUSINESS_UNITS.indexOf(byKey.get(b.parent)!)).toBeLessThan(BUSINESS_UNITS.indexOf(b));
    expect(byKey.get('mau-bu-north')?.parent).toBe('mau-bu-malva-dach');
    const customerKeys = new Set(CUSTOMERS.map((c) => c.key));
    for (const b of BUSINESS_UNITS) for (const a of b.associates) expect(customerKeys.has(a.customer)).toBe(true);
    const roles = BUSINESS_UNITS.flatMap((b) => b.associates.map((a) => a.role));
    expect(new Set(roles)).toEqual(new Set(['admin', 'buyer']));
    // wholesale buying is out of scope: no unit is attached to a buying store and carries no customer group
    for (const b of BUSINESS_UNITS) expect(b).not.toHaveProperty('group');
    expect(JSON.stringify(BUSINESS_UNITS)).not.toMatch(/wholesale|approver/i);
    expect(CUSTOMERS.some((c) => /approver/.test(c.key))).toBe(false);
  });

  it('gives every shopper a garage (max 5) of known vehicles, kept as JSON on the customer', () => {
    const known = new Set(VEHICLES.map((v) => v.fitmentKey));
    for (const c of CUSTOMERS.filter((x) => x.kind === 'shopper')) {
      expect(c.store).toBeTruthy();
      expect((c.garage ?? []).length).toBeGreaterThan(0);
      expect((c.garage ?? []).length).toBeLessThanOrEqual(5);
      expect((c.garage ?? []).every((g) => known.has(g.fitmentKey))).toBe(true);
      expect((c.garage ?? []).map((g) => g.id)).toContain(c.activeId);
      const json = JSON.parse(garageJson(c)) as { vehicles: { year: number; fitmentKey: string }[]; activeId: string };
      for (const v of json.vehicles) {
        const [, , from, to] = v.fitmentKey.split('|');
        expect(v.year >= Number(from) && v.year <= Number(to)).toBe(true); // the shopper's year lies inside the range
      }
    }
  });
});

describe('supporting data', () => {
  it('has DE 19 %, GB 20 % and a US 0 % placeholder tax rate, zones and three shipping methods incl. pickup', () => {
    const r = Object.fromEntries((taxCategoryDraft.rates ?? []).map((x) => [x.country, x.amount]));
    expect(r).toEqual({ DE: 0.19, GB: 0.2, US: 0 });
    expect(zoneDrafts.map((z) => z.key)).toEqual([K.zoneDe, K.zoneUs]);
    expect(shippingMethodDrafts.map((s) => s.key)).toEqual([K.shipStandard, K.shipExpress, K.shipPickup]);
    const pickup = shippingMethodDrafts.find((s) => s.key === K.shipPickup)!;
    expect(pickup.zoneRates?.every((z) => z.shippingRates?.every((s) => s.price.centAmount === 0))).toBe(true);
    expect(shippingMethodDrafts.filter((s) => s.isDefault)).toHaveLength(1);
  });

  it('has the recurrence policies subscriptions are sold with (monthly, every 3 and every 6 months)', () => {
    expect(recurrencePolicyDrafts.map((r) => r.schedule)).toEqual([
      { type: 'standard', value: 1, intervalUnit: 'Months' }, { type: 'standard', value: 3, intervalUnit: 'Months' }, { type: 'standard', value: 6, intervalUnit: 'Months' },
    ]);
  });

  it('has the custom types the specs need', () => {
    const t = Object.fromEntries(typeDrafts.map((x) => [x.key, x]));
    const names = (k: string) => t[k]?.fieldDefinitions?.map((f) => f.name) ?? [];
    expect(t[CONTRACT_TYPE_KEYS.storeSettings]?.resourceTypeIds).toEqual(['store']);
    expect(t[CONTRACT_TYPE_KEYS.branchInfo]?.resourceTypeIds).toEqual(['channel']);
    expect(t[CONTRACT_TYPE_KEYS.checkout]?.resourceTypeIds).toEqual(['cart', 'order']); // one type, so cart fields copy to the order
    expect(t[CONTRACT_TYPE_KEYS.line]?.resourceTypeIds).toEqual(['line-item']);
    expect(t[CONTRACT_TYPE_KEYS.customer]?.resourceTypeIds).toEqual(['customer']);
    expect(t[CONTRACT_TYPE_KEYS.returnItem]?.resourceTypeIds).toEqual(['order-return-item']);
    expect(t['mau-business-unit-fields']?.resourceTypeIds).toEqual(['business-unit']);
    expect(t['mau-cart-discount-fields']?.resourceTypeIds).toEqual(['cart-discount']);
    // each resource kind has exactly one type
    const kinds = typeDrafts.flatMap((x) => x.resourceTypeIds);
    expect(new Set(kinds).size).toBe(kinds.length);
    for (const f of ['mobile', 'pickupBranchKey', 'fitVehicleLabel', 'isTest', 'deliveredAt', 'salesChannel']) expect(names(CONTRACT_TYPE_KEYS.checkout)).toContain(f);
    const deliveredAt = t[CONTRACT_TYPE_KEYS.checkout]?.fieldDefinitions?.find((f) => f.name === 'deliveredAt');
    expect(deliveredAt?.type).toEqual({ name: 'DateTime' });
    for (const f of ['garage', 'mobile', 'marketingConsent', 'marketingConsentAt']) expect(names(CONTRACT_TYPE_KEYS.customer)).toContain(f);
    for (const f of ['returnNumber', 'status', 'reason', 'refundCents', 'rejectReason']) expect(names(CONTRACT_TYPE_KEYS.returnItem)).toContain(f);
    const status = t[CONTRACT_TYPE_KEYS.returnItem]?.fieldDefinitions?.find((f) => f.name === 'status')?.type as { values: { key: string }[] };
    expect(status.values.map((v) => v.key)).toEqual(['requested', 'in-transit', 'received', 'inspected', 'refunded', 'rejected']);
    for (const f of ['fit', 'vehicle', 'parentLineItemId']) expect(names(CONTRACT_TYPE_KEYS.line)).toContain(f);
  });

  it('keeps wholesale, purchase-order, payment-terms, approval and email data out of the seed', () => {
    const everything = JSON.stringify([typeDrafts, storeDrafts(), channelDrafts, roleDrafts, BUSINESS_UNITS, CUSTOMERS, productTypeDrafts, standalonePriceDrafts()]);
    expect(everything).not.toMatch(/wholesale|poNumber|paymentTerms|creditLimit|approval|outbox|contract-tier|customerGroup|mau-cg-/i);
    expect(OWNED_CONTAINERS.some((c) => /outbox|mail/.test(c))).toBe(false);
  });

  it('has the ready-for-pickup order state', () => {
    const s = stateDrafts.find((x) => x.key === 'ready-for-pickup')!;
    expect(s.type).toBe('OrderState');
    expect(s.initial).toBe(false);
  });

  it('has product and cart discounts with Malva-funded ones first and a code that needs a matching cart', () => {
    expect(productDiscountDrafts.length).toBeGreaterThanOrEqual(3);
    const malva = productDiscountDrafts.find((d) => d.key?.includes('malva'))!;
    // Higher sortOrder = higher rank (commercetools docs): Malva-funded values sit above every reseller value of the same kind.
    const reseller = productDiscountDrafts.filter((d) => !d.key?.includes('malva'));
    for (const d of reseller) expect(Number(malva.sortOrder)).toBeGreaterThan(Number(d.sortOrder));
    expect(Number(malva.sortOrder)).toBeGreaterThanOrEqual(0.9);
    expect(new Set(productDiscountDrafts.map((d) => d.sortOrder)).size).toBe(productDiscountDrafts.length);
    const cartMalva = cartDiscountDrafts.find((d) => d.key === 'mau-cd-malva-welcome')!;
    for (const d of cartDiscountDrafts.filter((x) => x !== cartMalva)) expect(Number(cartMalva.sortOrder)).toBeGreaterThan(Number(d.sortOrder));
    expect(new Set(cartDiscountDrafts.map((d) => d.sortOrder)).size).toBe(cartDiscountDrafts.length);
    for (const d of [...productDiscountDrafts, ...cartDiscountDrafts]) expect(d.sortOrder).not.toMatch(/0$/);
    const code = cartDiscountDrafts.find((d) => d.key === 'mau-cd-south-brake-code')!;
    expect(code.requiresDiscountCode).toBe(true);
    expect(code.cartPredicate).toContain('lineItemExists');
    expect(discountCodeDrafts.every((d) => d.cartDiscounts.length === 1)).toBe(true);
  });

  it('cart discounts are store scoped (reseller ones only, Malva-funded none) and product discounts carry a channel clause', () => {
    const stores = (key: string) => (cartDiscountDrafts.find((d) => d.key === key)!.stores ?? []).map((s) => (s as { key: string }).key);
    expect(stores('mau-cd-north-large-order')).toEqual([K.storeNorth]);
    expect(stores('mau-cd-south-brake-code')).toEqual([K.storeSouth]);
    expect(stores('mau-cd-south-free-shipping')).toEqual([K.storeSouth]);
    expect(stores('mau-cd-malva-welcome')).toEqual([]);
    expect(PRODUCT_DISCOUNT_CHANNEL).toEqual({ 'mau-pd-north-brake-week': K.distNorth, 'mau-pd-south-battery-bonus': K.distSouth });
    expect(channelClause('a contains "b"', 'ID1')).toBe('a contains "b" and channel.id = "ID1"');
    for (const d of cartDiscountDrafts) expect(JSON.stringify(d.custom)).not.toContain('maxDiscountPercent');
  });

  it('has popularity ranks (14, unique, only on carried parts) and 2 to 4 existing related SKUs per priced part', () => {
    const ranks = Object.values(POPULARITY);
    expect(ranks.length).toBe(14);
    expect([...ranks].sort((a, b) => a - b)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    for (const sku of Object.keys(POPULARITY)) {
      expect(PARTS.find((p) => p.sku === sku)?.eur).not.toBeNull();
      expect(assortmentSkus(K.storeNorth)).toContain(sku);
      expect(assortmentSkus(K.storeSouth)).toContain(sku);
    }
    const attr = (sku: string, name: string) => partAttributes(PARTS.find((p) => p.sku === sku)!).find((a) => a.name === name)?.value;
    expect(attr('MLV-BP-41001', 'popularity-rank')).toBe(1);
    expect(attr('MLV-BP-41099', 'popularity-rank')).toBeUndefined();
    const defs = productTypeDrafts.find((t) => t.key === K.ptPart)!.attributes!;
    expect(defs.find((a) => a.name === 'popularity-rank')).toMatchObject({ isSearchable: true, type: { name: 'number' } });
    expect(defs.find((a) => a.name === 'related-skus')).toMatchObject({ isSearchable: true, type: { name: 'set' } });
    const priced = new Set(PARTS.filter((p) => p.eur !== null).map((p) => p.sku));
    for (const p of PARTS.filter((x) => x.eur !== null)) {
      const rel = relatedSkus(p.sku);
      expect(rel.length, p.sku).toBeGreaterThanOrEqual(2);
      expect(rel.length, p.sku).toBeLessThanOrEqual(4);
      expect(rel.every((s) => priced.has(s) && s !== p.sku), p.sku).toBe(true);
      expect(new Set(rel).size).toBe(rel.length);
    }
  });

  it('has reviews for at least 5 products carried by both resellers, ratings 1 to 5, unique keys, plain (no state)', () => {
    const drafts = reviewDrafts();
    expect(reviewedSkus().length).toBeGreaterThanOrEqual(5);
    expect(new Set(drafts.map((d) => d.key)).size).toBe(drafts.length);
    for (const sku of reviewedSkus()) {
      expect(assortmentSkus(K.storeNorth)).toContain(sku);
      expect(assortmentSkus(K.storeSouth)).toContain(sku);
    }
    for (const d of drafts) {
      expect(d.key).toMatch(/^mau-rev-/);
      expect(d).not.toHaveProperty('state');
      expect(Number.isInteger(d.rating) && d.rating! >= 1 && d.rating! <= 5).toBe(true);
      expect((d.target as { key: string }).key).toMatch(/^mau-part-/);
    }
    const avg = (sku: string) => { const r = REVIEWS.filter((x) => x.sku === sku); return r.reduce((s, x) => s + x.rating, 0) / r.length; };
    expect(new Set(reviewedSkus().map(avg)).size).toBeGreaterThan(3); // different averages, so "Top rated" orders something
  });

  it('adds the optional fields the portal asked for and the pending local review record', () => {
    const t = Object.fromEntries(typeDrafts.map((x) => [x.key, (x.fieldDefinitions ?? []).map((f) => f.name)]));
    expect(t['malva-return-item']).toContain('refundRequestedAt');
    expect(t['mau-business-unit-fields']).toEqual(expect.arrayContaining(['legalName', 'taxId', 'accountNumber']));
    expect(t['malva-customer']).toContain('jobTitle');
    const north = BUSINESS_UNITS.find((b) => b.key === 'mau-bu-north')!;
    expect(north.profile?.legalName).toBeTruthy();
    expect(JSON.stringify((businessUnitDraft(north).custom as { fields: unknown }).fields)).toContain('taxId');
    expect(JSON.stringify(businessUnitDraft(BUSINESS_UNITS.find((b) => b.key === 'mau-bu-malva')!).custom)).not.toContain('taxId');
    expect((customerDraft(CUSTOMERS.find((c) => c.key === 'mau-cust-north-admin')!, 'x').custom as { fields: { jobTitle?: string } }).fields.jobTitle).toBeTruthy();
    expect(localReviewObjects()).toEqual([{ container: 'malva-local-review', key: 'mau-reseller-south--mau-local-sk-2002', value: { state: 'pending', claimedVehicles: [] } }]);
  });

  it('inventory covers the warehouse and branches, with some branch gaps so "ships in 2-3 days" shows', () => {
    const inv = inventoryDrafts();
    const dc = inv.filter((i) => (i.supplyChannel as { key?: string }).key === K.supplyMalva);
    expect(dc.length).toBe(PARTS.filter((p) => p.eur !== null).length);
    const branch = inv.filter((i) => (i.supplyChannel as { key?: string }).key?.startsWith('mau-br-'));
    expect(branch.length).toBeGreaterThan(50);
    const hamburg = branch.filter((i) => (i.supplyChannel as { key?: string }).key === 'mau-br-north-hamburg');
    expect(hamburg.length).toBeLessThan(assortmentSkus(K.storeNorth).length);
    expect(inv.every((i) => i.quantityOnStock > 0)).toBe(true);
  });

  it('theme has every required ThemeTokens field and the Garage Maroon primary', () => {
    for (const f of ['colorPrimary', 'colorPrimaryHover', 'colorSecondary', 'colorBackground', 'colorSurface', 'colorText', 'colorTextMuted', 'borderRadius', 'borderWidth', 'fontFamily', 'fontHeading', 'spacingScale', 'buttonStyle', 'cardShadow', 'headerStyle']) expect(defaultTheme).toHaveProperty(f);
    expect(defaultTheme.colorPrimary).toBe('#821810');
  });

  it('tailorings are text and images published at once, for products in the store assortment, with clean image URLs and no review state', () => {
    expect(TAILORINGS.length).toBeGreaterThanOrEqual(4);
    for (const t of TAILORINGS) {
      expect(assortmentSkus(t.store)).toContain(t.sku);
      expect(t).not.toHaveProperty('state');
      expect(t).not.toHaveProperty('reason');
      const d = tailoringDraft(t) as { publish: boolean; variants?: { sku: string; images: { url: string }[] }[] };
      expect(d.publish).toBe(true);
      for (const v of d.variants ?? []) for (const img of v.images) expect(isCleanUrl(img.url)).toBe(true);
    }
    const withImages = TAILORINGS.filter((t) => (t.images ?? []).length > 0);
    expect(withImages.length).toBeGreaterThanOrEqual(2);
    expect(new Set(withImages.map((t) => t.store)).size).toBe(2); // both resellers
    expect(tailoringDraft(withImages[0]!)).toHaveProperty('variants');
    expect(tailoringDraft(TAILORINGS.find((t) => !t.images)!)).not.toHaveProperty('variants');
    expect(tailoringKey(K.storeNorth, 'MLV-BP-41001')).toBe('mau-tl-north-mlv-bp-41001');
  });

  it('stored recorded image data is clean', () => {
    for (const f of ['product-images.json', 'category-images.json', 'banner-images.json', 'tailoring-images.json']) {
      const urls = [...readFileSync(new URL(f, dataDir), 'utf8').matchAll(/"url":\s*"([^"]+)"/g)].map((m) => m[1]!);
      expect(urls.filter((u) => !isCleanUrl(u))).toEqual([]);
    }
  });
});

describe('demo login support', () => {
  it('marks every seeded customer as a demo account (listed by the demo login pickers)', () => {
    for (const c of CUSTOMERS) {
      const draft = customerDraft(c, 'x') as { custom?: { fields?: { isDemo?: boolean } } };
      expect(draft.custom?.fields?.isDemo, c.key).toBe(true);
    }
  });
});
