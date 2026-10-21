// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTRACT_KEYS, LANGUAGES, MARKETS, hash, slugify } from './data/base';
import { CATEGORIES, categoryDrafts, categoryDepth } from './data/categories';
import { CUSTOMERS, customerDraft, shoppingListDraft } from './data/customers';
import { typeDrafts } from './data/custom-types';
import { cartDiscountDrafts, discountCodeDrafts, productDiscountDrafts } from './data/discounts';
import { inventoryDrafts, recurrencePolicyDrafts } from './data/extras';
import { allPriceDefs, oneTimeCents, priceDefsOf, recurringCents } from './data/prices';
import { productTypeDrafts } from './data/product-types';
import { PRODUCTS, allVariants } from './data/products';
import { productDrafts } from './data/catalog';
import { stateDrafts, stateCreationOrder } from './data/states';
import { STORES, channelDrafts } from './data/stores';
import { shippingMethodDrafts, taxCategoryDrafts, zoneDrafts } from './data/tax-shipping';
import { SEED_DIR } from './lib';

describe('seed data (SEED-PLAN)', () => {
  it('about 40 products over the five product types, with 3 to 4 pack, size or colour variants where the plan says so', () => {
    expect(PRODUCTS.length).toBeGreaterThanOrEqual(38);
    expect(PRODUCTS.length).toBeLessThanOrEqual(45);
    const byKind = (k: string) => PRODUCTS.filter((p) => p.kind === k);
    expect(byKind('pods')).toHaveLength(12);
    expect(PRODUCTS.filter((p) => p.code.startsWith('POD-')).filter((p) => p.common.system === 'original')).toHaveLength(6);
    expect(PRODUCTS.filter((p) => p.common.system === 'vertuo' && p.kind === 'pods')).toHaveLength(6);
    for (const p of byKind('pods')) expect(p.variants.map((v) => v.attrs.capsulesPerPack)).toEqual([10, 50, 100]);
    expect(byKind('coffee')).toHaveLength(10);
    for (const p of byKind('coffee')) expect(new Set(p.variants.map((v) => v.attrs.sizeGrams))).toEqual(new Set([250, 1000]));
    expect(byKind('machine')).toHaveLength(8);
    expect(byKind('accessory')).toHaveLength(8);
    expect(byKind('gift')).toHaveLength(3);
    expect(new Set(PRODUCTS.map((p) => p.key)).size).toBe(PRODUCTS.length);
    expect(new Set(allVariants().map((v) => v.variant.sku)).size).toBe(allVariants().length);
  });

  it('names, descriptions and slugs exist in en-US and en-CA, slugs are unique per locale', () => {
    for (const p of PRODUCTS) {
      for (const l of LANGUAGES) {
        expect(p.name[l], `${p.key} name ${l}`).toBeTruthy();
        expect(p.description[l], `${p.key} description ${l}`).toBeTruthy();
        expect(p.slug[l], `${p.key} slug ${l}`).toMatch(/^[a-z0-9-]+$/);
      }
    }
    for (const l of LANGUAGES) expect(new Set(PRODUCTS.map((p) => p.slug[l])).size, `slugs ${l}`).toBe(PRODUCTS.length);
    // Canadian and American spelling differ
    const pod = PRODUCTS.find((p) => p.code === 'POD-EMBER');
    expect(pod?.description['en-US']).toContain('flavor');
    expect(pod?.description['en-CA']).toContain('flavour');
  });

  it('pods are described as compatible with Nespresso Original or Vertuo and the brand is never a product name', () => {
    for (const p of PRODUCTS.filter((x) => x.kind === 'pods')) {
      const sys = p.common.system === 'original' ? 'Original' : 'Vertuo';
      expect(p.description['en-US']).toContain(`Compatible with Nespresso ${sys} machines`);
      expect(p.description['en-CA']).toContain(`Compatible with Nespresso ${sys} machines`);
    }
    for (const p of PRODUCTS) for (const l of LANGUAGES) expect(p.name[l], p.key).not.toMatch(/nespresso/i);
    for (const k of categoryDrafts()) expect(JSON.stringify(k.name)).not.toMatch(/nespresso/i);
  });

  it('every key the seed creates starts with mcf- (or is a contract key)', () => {
    const keys = [
      ...taxCategoryDrafts, ...zoneDrafts, ...shippingMethodDrafts, ...typeDrafts, ...stateDrafts, ...productTypeDrafts, ...categoryDrafts(), ...channelDrafts(),
      ...recurrencePolicyDrafts, ...productDiscountDrafts(), ...cartDiscountDrafts, ...discountCodeDrafts, ...inventoryDrafts(), ...CUSTOMERS, shoppingListDraft(), ...PRODUCTS,
    ].map((d) => (d as { key?: string }).key);
    for (const k of keys) expect(k, String(k)).toMatch(/^mcf-/);
    for (const k of CONTRACT_KEYS) expect(k).toMatch(/^mcf-/);
    expect(CONTRACT_KEYS).toEqual(expect.arrayContaining(stateDrafts.map((s) => s.key)));
    expect(CONTRACT_KEYS).toEqual(expect.arrayContaining(typeDrafts.map((t) => t.key)));
  });

  it('tax categories follow D-036: US food 0 / standard 8 (NY 8.875), Canada food 0 / GST 5 as country-level rates; all tax-exclusive', () => {
    const rates = (key: string) => taxCategoryDrafts.find((t) => t.key === key)?.rates ?? [];
    const food = rates('mcf-tax-food');
    expect(food.map((r) => [r.country, r.amount])).toEqual([['US', 0], ['CA', 0]]);
    const std = rates('mcf-tax-standard');
    expect(std.find((r) => r.country === 'US' && !r.state)?.amount).toBe(0.08);
    expect(std.find((r) => r.state === 'NY')?.amount).toBe(0.08875);
    const ca = std.filter((r) => r.country === 'CA');
    expect(ca).toHaveLength(1);
    expect(ca[0]?.amount).toBe(0.05);
    expect(ca[0]?.state).toBeUndefined(); // country-level: the fallback serves every province
    for (const r of [...food, ...std]) expect(r.includedInPrice).toBe(MARKETS[r.country as 'US' | 'CA'].taxIncluded);
  });

  it('two zones and three shipping methods; standard has a free-above tier per currency, collection is US only', () => {
    expect(zoneDrafts.map((z) => z.key)).toEqual(['mcf-zone-us', 'mcf-zone-ca']);
    expect(shippingMethodDrafts.map((m) => m.key)).toEqual(['mcf-ship-standard', 'mcf-ship-express', 'mcf-collect']);
    const std = shippingMethodDrafts[0]!.zoneRates!.map((z) => z.shippingRates![0]!);
    expect(std.map((r) => [r.price.currencyCode, r.price.centAmount, r.freeAbove?.centAmount])).toEqual([['USD', 695, 7500], ['CAD', 895, 9900]]);
    expect(shippingMethodDrafts[1]!.zoneRates!.map((z) => z.shippingRates![0]!.price.centAmount)).toEqual([1495, 1995]);
    expect(shippingMethodDrafts[2]!.zoneRates!.map((z) => (z.zone as { key: string }).key)).toEqual(['mcf-zone-us']);
  });

  it('six stores in New York City as InventorySupply channels, ready in 30 minutes, with a store type and hours', () => {
    expect(STORES.map((s) => s.key)).toEqual(['mcf-store-nyc-soho', 'mcf-store-brooklyn-williamsburg', 'mcf-store-upper-west-side', 'mcf-store-midtown-east', 'mcf-store-long-island-city', 'mcf-store-harlem']);
    for (const c of channelDrafts()) {
      expect(c.roles).toEqual(['InventorySupply']);
      expect(c.geoLocation).toMatchObject({ type: 'Point' });
      expect(c.custom?.type).toMatchObject({ key: 'mcf-store' });
      expect(c.address).toMatchObject({ country: 'US', state: 'NY' });
      const [lng, lat] = (c.geoLocation as unknown as { coordinates: [number, number] }).coordinates;
      expect(lat).toBeGreaterThan(40.4);
      expect(lat).toBeLessThan(41);
      expect(lng).toBeGreaterThan(-74.3);
      expect(lng).toBeLessThan(-73.6);
    }
    for (const s of STORES) expect(s.collectionMinutes).toBe(30);
    expect(STORES.every((s) => s.country === 'US')).toBe(true);
    expect(STORES.some((s) => s.hours.sun === 'closed')).toBe(true);
    expect(STORES.some((s) => s.hours.sun !== 'closed')).toBe(true);
  });

  it('order states chain ordered > preparing > ready > collected, there are no review states (D-037); creation order puts targets first', () => {
    expect(stateDrafts.filter((s) => s.type === 'OrderState').map((s) => s.key)).toEqual(['mcf-order-ordered', 'mcf-order-preparing', 'mcf-order-ready-for-collection', 'mcf-order-collected']);
    expect(stateDrafts.find((s) => s.key === 'mcf-order-ordered')?.initial).toBe(true);
    expect(stateDrafts.every((s) => s.type === 'OrderState')).toBe(true);
    const order = stateCreationOrder().map((s) => s.key);
    for (const s of stateDrafts) for (const t of s.transitions ?? []) expect(order.indexOf(t.key as string)).toBeLessThan(order.indexOf(s.key));
  });

  it('five product types with the planned attributes and product-level badge and subscribable', () => {
    expect(productTypeDrafts.map((t) => t.key)).toEqual(['mcf-pods', 'mcf-coffee', 'mcf-machine', 'mcf-accessory', 'mcf-gift-set']);
    const names = (key: string | undefined) => productTypeDrafts.find((t) => t.key === key)?.attributes?.map((a) => a.name) ?? [];
    expect(names('mcf-pods')).toEqual(expect.arrayContaining(['system', 'intensity', 'roast', 'flavourNotes', 'origin', 'decaf', 'organic', 'fairtrade', 'capsulesPerPack']));
    expect(names('mcf-coffee')).toEqual(expect.arrayContaining(['roast', 'origin', 'process', 'flavourNotes', 'intensity', 'brewMethods', 'sizeGrams', 'grind']));
    expect(names('mcf-machine')).toEqual(expect.arrayContaining(['system', 'pressureBar', 'waterTankMl', 'powerWatts', 'features', 'warrantyMonths', 'colour', 'bundle']));
    expect(names('mcf-accessory')).toEqual(expect.arrayContaining(['kind', 'material', 'capacityMl', 'colour']));
    expect(names('mcf-gift-set')).toEqual(expect.arrayContaining(['contents', 'occasion']));
    for (const t of productTypeDrafts) expect(names(t.key)).toEqual(expect.arrayContaining(['badge', 'subscribable']));
    // every attribute the products set is defined on its type
    const defined = new Map(productTypeDrafts.map((t) => [t.key, new Set(names(t.key))]));
    for (const p of PRODUCTS) for (const v of p.variants) for (const a of Object.keys({ ...p.common, ...v.attrs })) expect(defined.get(p.productType)?.has(a), `${p.key}.${a}`).toBe(true);
  });

  it('categories form the planned tree with slugs in three languages, unique per language, and valid order hints', () => {
    expect(CATEGORIES.filter((c) => !c.parent).map((c) => c.key)).toEqual(['mcf-cat-pods', 'mcf-cat-coffee', 'mcf-cat-machines', 'mcf-cat-accessories', 'mcf-cat-gifts']);
    expect(CATEGORIES).toHaveLength(20);
    for (const l of LANGUAGES) expect(new Set(categoryDrafts().map((c) => (c.slug as Record<string, string>)[l])).size).toBe(20);
    for (const c of categoryDrafts()) expect(c.orderHint).toMatch(/^0\.\d*[1-9]$/);
    const idx = new Map(CATEGORIES.map((c, i) => [c.key, i]));
    for (const c of CATEGORIES) if (c.parent) expect(idx.get(c.parent)).toBeLessThan(idx.get(c.key) as number);
    expect(categoryDepth('mcf-cat-pods-vertuo')).toBe(1);
    const keys = new Set(CATEGORIES.map((c) => c.key));
    for (const p of PRODUCTS) for (const c of p.categories) expect(keys.has(c), `${p.key} ${c}`).toBe(true);
  });

  it('prices: one per market per variant, CAD about 1.37 of USD on .x0 or .x5, both tax-exclusive', () => {
    for (const { product, variant } of allVariants()) {
      const defs = priceDefsOf(product, variant).filter((d) => !d.policy);
      expect(defs.map((d) => [d.country, d.currency])).toEqual([['US', 'USD'], ['CA', 'CAD']]);
      expect(variant.usd % 5).toBe(0);
      expect(oneTimeCents(variant.usd, 'CAD') % 5).toBe(0);
      expect(Math.abs(oneTimeCents(variant.usd, 'CAD') / variant.usd - 1.37)).toBeLessThan(0.01);
      expect(oneTimeCents(variant.usd, 'CAD')).not.toBe(variant.usd);
    }
    expect(oneTimeCents(590, 'USD')).toBe(590);
  });

  it('recurrencePrices: subscribable products get one 10% cheaper price per policy and market, others none', () => {
    for (const { product, variant } of allVariants()) {
      const defs = priceDefsOf(product, variant);
      const recurring = defs.filter((d) => d.policy);
      expect(recurring).toHaveLength(product.subscribable ? 8 : 0);
      for (const r of recurring) {
        const base = defs.find((d) => !d.policy && d.country === r.country);
        expect(r.cents).toBe(recurringCents(base!.cents));
        expect(Math.abs(r.cents / base!.cents - 0.9)).toBeLessThan(0.005);
      }
    }
    expect(allPriceDefs().length).toBeGreaterThan(700);
    // the draft the API gets carries the policy as a resource identifier by key
    const sub = PRODUCTS.find((p) => p.subscribable)!;
    const draft = productDrafts({}, true).find((d) => d.key === sub.key)!;
    const prices = ((draft.masterVariant as { prices: { recurrencePolicy?: { typeId: string; key: string }; value: { centAmount: number } }[] }).prices);
    expect(prices.filter((p) => p.recurrencePolicy).every((p) => p.recurrencePolicy?.typeId === 'recurrence-policy' && p.recurrencePolicy.key.startsWith('mcf-every-'))).toBe(true);
  });

  it('four recurrence policies with standard schedules', () => {
    expect(recurrencePolicyDrafts.map((r) => [r.key, r.schedule])).toEqual([
      ['mcf-every-2-weeks', { type: 'standard', value: 2, intervalUnit: 'Weeks' }], ['mcf-every-month', { type: 'standard', value: 1, intervalUnit: 'Months' }],
      ['mcf-every-2-months', { type: 'standard', value: 2, intervalUnit: 'Months' }], ['mcf-every-3-months', { type: 'standard', value: 3, intervalUnit: 'Months' }],
    ]);
  });

  it('discounts and codes WELCOME10, FREESHIP and COFFEE15 with unique sort orders; one automatic seasonal product discount', () => {
    expect(discountCodeDrafts.map((c) => c.code)).toEqual(['WELCOME10', 'FREESHIP', 'COFFEE15']);
    expect(cartDiscountDrafts.every((d) => d.stackingMode === 'Stacking' && d.requiresDiscountCode)).toBe(true);
    expect(new Set(cartDiscountDrafts.map((d) => d.sortOrder)).size).toBe(3);
    expect(cartDiscountDrafts[0]?.value).toEqual({ type: 'relative', permyriad: 1000 });
    expect(cartDiscountDrafts[1]?.target).toEqual({ type: 'shipping' });
    expect(cartDiscountDrafts[2]?.value).toMatchObject({ type: 'absolute' });
    const pd = productDiscountDrafts();
    expect(pd).toHaveLength(1);
    expect(pd[0]?.predicate).toContain('MCF-MAC-POD1-BLA-M');
    for (const d of [...cartDiscountDrafts, ...pd]) expect(d.sortOrder).toMatch(/^0\.\d*[1-9]$/);
  });

  it('six verified demo customers with addresses, four US and two CA, and a saved-items list for Maya', () => {
    expect(CUSTOMERS.map((c) => c.email)).toEqual(['maya.okonkwo@example.com', 'liam.carter@example.com', 'priya.nair@example.com', 'lucas.tremblay@example.com', 'ava.mackenzie@example.com', 'noah.patel@example.com']);
    for (const c of CUSTOMERS) {
      const d = customerDraft(c, 'a-long-demo-password') as { addresses: { country: string }[]; isEmailVerified: boolean; locale: string; defaultShippingAddress: number };
      expect(d.addresses[0]?.country).toBe(c.country);
      expect(d.isEmailVerified).toBe(true);
      expect(d.locale).toBe(MARKETS[c.country].locale);
      expect(c.email).toMatch(/@example\.com$/);
    }
    expect(shoppingListDraft().key).toBe('mcf-saved-maya');
    expect(shoppingListDraft().lineItems).toHaveLength(3);
  });

  it('hash is deterministic', () => {
    expect(hash('a')).toBe(hash('a'));
    expect(slugify('Cold Brew & Co.')).toBe('cold-brew-co');
  });

  it('contains no real credential, no secret value and every source file has the SPDX header', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        if (f === 'node_modules' || f === '.git') continue;
        const p = path.join(dir, f);
        if (statSync(p).isDirectory()) walk(p); else files.push(p);
      }
    };
    walk(SEED_DIR);
    for (const f of files.filter((x) => /\.(ts|md)$/.test(x))) {
      const head = readFileSync(f, 'utf8').slice(0, 300);
      expect(head, f).toContain('SPDX-License-Identifier: MIT');
      expect(head, f).toContain('commercetools GmbH');
    }
    const envExample = readFileSync(path.join(SEED_DIR, '.env.example'), 'utf8');
    for (const line of envExample.split('\n').filter((l) => /^[A-Z_]+=/.test(l))) expect(line.endsWith('='), line).toBe(true); // names only
    expect(readFileSync(path.join(SEED_DIR, '.gitignore'), 'utf8')).toMatch(/\.env\.\*[\s\S]*cleanup-manifest\.json|cleanup-manifest\.json[\s\S]*\.env\.\*/);
  });
});
