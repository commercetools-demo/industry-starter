// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { K } from './data/base';
import { assortmentKeys } from './data/assortment';
import { allProductDrafts } from './data/catalog';
import { TAILORINGS, tailoringImageKey } from './data/content';
import { CUSTOMERS } from './data/org';
import { priceDefs, standalonePriceDrafts, type PriceDef } from './data/prices';
import { FakeApi } from './fake-api';
import { Runner } from './lib';
import { STEP_NAMES, runSeed, selectSteps } from './seed';
import { checkPrices, checkProduct, verifySeed } from './verify';
import type { Res } from './api';

const quiet = () => undefined;
const opts = (api: FakeApi, dryRun = false) => ({ api, run: new Runner(dryRun, quiet), demoPassword: 'a-long-demo-password' });

describe('seed against the in-memory API', () => {
  it('creates everything in dependency order (no unresolved reference) and verify finds no problem', async () => {
    const api = new FakeApi();
    const changes = await runSeed(opts(api));
    expect(changes).toBeGreaterThan(300);
    expect(await verifySeed(api)).toEqual([]);
    expect(api.project.searchIndexing?.productsSearch?.status).toBe('Activated');
    expect(api.project.carts?.countryTaxRateFallbackEnabled).toBe(true);
  });

  it('is idempotent: a second run reports 0 changes and performs no write', async () => {
    const api = new FakeApi();
    await runSeed(opts(api));
    const writes = api.writes;
    const second = new Runner(false, quiet);
    expect(await runSeed({ ...opts(api), run: second })).toBe(0);
    expect(second.lines).toEqual([]);
    expect(api.writes).toBe(writes);
  });

  it('a dry run on an empty project plans changes but writes nothing', async () => {
    const api = new FakeApi();
    const run = new Runner(true, quiet);
    const changes = await runSeed({ ...opts(api), run });
    expect(changes).toBeGreaterThan(0);
    expect(run.lines.every((l) => l.startsWith('would '))).toBe(true);
    expect(api.writes).toBe(0);
  });

  it('repairs drift: a changed standalone price, a missing selection product and a changed store assignment come back', async () => {
    const api = new FakeApi();
    await runSeed(opts(api));
    // wrong Malva base price (a standalone price)
    const price = (await api.getByKey('standalone-prices', 'MLV-BP-41001__base-eur-de')) as Res;
    await api.update('standalone-prices', price, [{ action: 'changeValue', value: { currencyCode: 'EUR', centAmount: 1 } }]);
    // drop a product from the north selection
    const sel = (await api.getByKey('product-selections', K.selNorth)) as Res;
    const members = await api.listSelectionProducts(sel.id);
    await api.update('product-selections', sel, [{ action: 'removeProduct', product: { typeId: 'product', id: members[0] } }]);
    // remove the selection from a store
    const store = (await api.getByKey('stores', K.storeSouth)) as Res;
    await api.update('stores', store, [{ action: 'setProductSelections', productSelections: [] }]);
    expect((await verifySeed(api)).length).toBeGreaterThan(0);

    const run = new Runner(false, quiet);
    const changes = await runSeed({ ...opts(api), run });
    expect(changes).toBe(3);
    expect(run.lines.some((l) => l.includes('update standalone price MLV-BP-41001__base-eur-de (changeValue)'))).toBe(true);
    expect(await verifySeed(api)).toEqual([]);
  });

  it('creates every price as a standalone price: base on no channel, retail and branch prices on channels, none embedded', async () => {
    const api = new FakeApi();
    await runSeed(opts(api));
    const want = standalonePriceDrafts();
    const have = api.all('standalone-prices');
    expect(have).toHaveLength(want.length);
    const ids = new Map(api.all('channels').map((c) => [c.id, c.key]));
    const channelOf = (key: string) => { const c = (have.find((x) => x.key === key)?.channel as { id: string } | undefined); return c ? ids.get(c.id) : undefined; };
    expect(channelOf('MLV-BP-41001__base-eur-de')).toBeUndefined();
    expect(channelOf(want.find((d) => d.channel)!.key as string)).toBeDefined();
    for (const p of api.all('products')) expect((p.masterData as { staged: { masterVariant: { prices?: unknown[] } } }).staged.masterVariant.prices ?? []).toEqual([]);
    expect(have.every((x) => (x.value as { centAmount: number }).centAmount > 0)).toBe(true);
    expect(have.some((x) => x.sku === 'MLV-BP-41099')).toBe(false); // pre-release: no price at all
  });

  it('seeds reviews, store scoped cart discounts, channel scoped product discounts and the pending local review record; drift comes back', async () => {
    const api = new FakeApi();
    await runSeed(opts(api));
    expect(api.all('reviews').length).toBeGreaterThanOrEqual(10);
    expect(api.all('reviews').every((r) => (r.target as { typeId: string }).typeId === 'product')).toBe(true);
    const storeIds = new Map(api.all('stores').map((st) => [st.id, st.key]));
    const storesOf = async (key: string) => ((((await api.getByKey('cart-discounts', key)) as Res).stores ?? []) as { id: string }[]).map((x) => storeIds.get(x.id));
    expect(await storesOf('mau-cd-north-large-order')).toEqual([K.storeNorth]);
    expect(await storesOf('mau-cd-malva-welcome')).toEqual([]);
    const north = (await api.getByKey('channels', K.distNorth)) as Res;
    expect(((await api.getByKey('product-discounts', 'mau-pd-north-brake-week')) as Res).predicate).toContain(`channel.id = "${north.id}"`);
    expect(((await api.getByKey('product-discounts', 'mau-pd-malva-filter-autumn')) as Res).predicate).not.toContain('channel.id');
    expect(await api.getObject('malva-local-review', 'mau-reseller-south--mau-local-sk-2002')).toMatchObject({ value: { state: 'pending' } });
    // drift: wrong store scope, wrong review rating, wrong sortOrder, portal-owned local review record changed (must stay)
    const cd = (await api.getByKey('cart-discounts', 'mau-cd-south-brake-code')) as Res;
    await api.update('cart-discounts', cd, [{ action: 'setStores', stores: [] }]);
    const rv = (await api.getByKey('reviews', 'mau-rev-mlv-bp-41001-1')) as Res;
    await api.update('reviews', rv, [{ action: 'setRating', rating: 1 }]);
    await api.putObject('malva-local-review', 'mau-reseller-south--mau-local-sk-2002', { state: 'approved', claimedVehicles: ['x'] });
    expect((await verifySeed(api)).join('\n')).toMatch(/cart discount mau-cd-south-brake-code: stores none[\s\S]*review mau-rev-mlv-bp-41001-1: rating 1/);
    const run = new Runner(false, quiet);
    expect(await runSeed({ ...opts(api), run })).toBe(2);
    expect(await verifySeed(api)).toEqual([]);
    expect(await api.getObject('malva-local-review', 'mau-reseller-south--mau-local-sk-2002')).toMatchObject({ value: { state: 'approved' } });
  });

  it('seeds the ready-for-pickup state, tailorings with images published at once, and no email or outbox object', async () => {
    const api = new FakeApi();
    await runSeed(opts(api));
    expect(await api.getByKey('states', 'ready-for-pickup')).toBeDefined();
    const tailorings = api.all('product-tailoring');
    expect(tailorings).toHaveLength(TAILORINGS.length);
    expect(tailorings.every((t) => t.published === true)).toBe(true);
    const imaged = tailorings.filter((t) => ((t.staged as { variants?: { images?: unknown[] }[] }).variants ?? []).some((v) => (v.images ?? []).length > 0));
    expect(imaged.length).toBeGreaterThanOrEqual(2);
    expect([...api.objects.values()].some((o) => /mail|outbox|tailoring-review/.test(o.container))).toBe(false);
    expect((await api.getByKey('stores', 'mau-malva-wholesale'))).toBeUndefined();
    expect(api.all('customer-groups')).toEqual([]);
  });

  it('a changed tailored image is re-applied and published once, then stays idempotent', async () => {
    const api = new FakeApi();
    await runSeed(opts(api));
    const key = tailoringImageKey(K.storeNorth, 'MLV-BP-41001');
    const tailoringImages = { [key]: [{ url: 'https://images.pexels.com/photos/9/pexels-photo-9.jpeg', dimensions: { w: 100, h: 80 } }] };
    const run = new Runner(false, quiet);
    expect(await runSeed({ ...opts(api), run, tailoringImages })).toBe(1);
    expect(run.lines[0]).toContain('setExternalImages');
    expect(run.lines[0]).toContain('publish');
    expect(await runSeed({ ...opts(api), tailoringImages })).toBe(0);
  });

  it('uses recorded images, republishes the product once and then stays idempotent', async () => {
    const api = new FakeApi();
    await runSeed(opts(api));
    const images = { 'mau-part-mlv-bp-41001': [{ url: 'https://images.pexels.com/photos/1/pexels-photo-1.jpeg', dimensions: { w: 100, h: 80 } }] };
    const run = new Runner(false, quiet);
    expect(await runSeed({ ...opts(api), run, images })).toBe(1);
    expect(run.lines[0]).toContain('addExternalImage');
    expect(await runSeed({ ...opts(api), images })).toBe(0);
    const missing = await verifySeed(api);
    expect(missing).toEqual([]);
  });

  it('seeds nothing for images when no recorded file exists (empty images, no failure)', async () => {
    const api = new FakeApi();
    await runSeed(opts(api));
    const p = (await api.getByKey('products', 'mau-part-mlv-bp-41001')) as Res;
    expect((p.masterData as { current: { masterVariant: { images: unknown[] } } }).current.masterVariant.images).toEqual([]);
  });

  it('creates the pre-release part without prices, the pending local part unpublished, and keeps them out of selections', async () => {
    const api = new FakeApi();
    await runSeed(opts(api));
    const pre = (await api.getByKey('products', 'mau-part-mlv-bp-41099')) as Res;
    expect((pre.masterData as { staged: { masterVariant: { prices?: unknown[] } } }).staged.masterVariant.prices ?? []).toEqual([]);
    expect(api.all('standalone-prices').some((x) => x.sku === 'MLV-BP-41099')).toBe(false);
    const pending = (await api.getByKey('products', 'mau-local-sk-2002')) as Res;
    expect((pending.masterData as { published: boolean }).published).toBe(false);
    const master = (await api.getByKey('product-selections', K.selMaster)) as Res;
    expect(await api.listSelectionProducts(master.id)).toContain(pre.id);
    const south = (await api.getByKey('product-selections', K.selSouth)) as Res;
    expect(await api.listSelectionProducts(south.id)).not.toContain(pending.id);
  });

  it('gives the two resellers different selections and assigns them to their stores', async () => {
    const api = new FakeApi();
    await runSeed(opts(api));
    const sizes = await Promise.all([K.selNorth, K.selSouth].map(async (k) => (await api.listSelectionProducts(((await api.getByKey('product-selections', k)) as Res).id)).length));
    expect(sizes[0]).toBe(assortmentKeys(K.storeNorth).length);
    expect(sizes[1]).toBe(assortmentKeys(K.storeSouth).length);
    expect(sizes[0]).not.toBe(sizes[1]);
  });

  it('never stores the demo password and requires one of at least 10 characters', async () => {
    const api = new FakeApi();
    await runSeed(opts(api), 'tax-shipping');
    await expect(runSeed({ ...opts(api), demoPassword: 'short' }, 'customers')).rejects.toThrow(/SEED_DEMO_PASSWORD/);
    const full = new FakeApi();
    await runSeed(opts(full));
    for (const c of CUSTOMERS) {
      const stored = await full.getByKey('customers', c.key);
      expect(stored).toBeDefined();
      expect(JSON.stringify(stored)).not.toContain('a-long-demo-password');
    }
  });

  it('rejects an unknown step and supports --only', async () => {
    expect(() => selectSteps('nope')).toThrow(/Unknown step nope/);
    expect(selectSteps('settings,tax-shipping').map((s) => s.name)).toEqual(['settings', 'tax-shipping']);
    expect(STEP_NAMES[0]).toBe('settings');
    const api = new FakeApi();
    await expect(runSeed(opts(api), 'products')).rejects.toThrow(/ReferencedResourceNotFound/); // order matters: products need categories first
  });

  it('keeps the Contentools default theme untouched when it already exists', async () => {
    const api = new FakeApi();
    await api.putObject('configuration', 'default-theme', { colorPrimary: '#000000' });
    await runSeed(opts(api));
    expect((await api.getObject('configuration', 'default-theme'))?.value).toEqual({ colorPrimary: '#000000' });
  });
});

describe('checkProduct', () => {
  const full = [{ name: 'universal-fit', value: true }, { name: 'part-number', value: 'x' }, { name: 'brand', value: 'b' }, { name: 'quality-tier', value: 'oem' }, { name: 'warranty-months', value: 1 }];
  const base = (over: Record<string, unknown>, priceMode: string | undefined = 'Standalone'): Res => ({
    id: '1', version: 1, key: 'mau-part-x', priceMode, productType: { id: 'pt' },
    masterData: { published: true, current: { masterVariant: { attributes: [], images: [], ...over } }, staged: { masterVariant: {} } },
  });

  it('flags unclean images, missing attributes and a missing fit statement', () => {
    const problems = checkProduct(base({ images: [{ url: 'https://x.test/a.jpg?w=1' }] }), true).join('\n');
    expect(problems).toMatch(/image URL is not clean/);
    expect(problems).toMatch(/attribute brand missing/);
    expect(problems).toMatch(/neither fitment-keys nor universal-fit/);
  });

  it('accepts a complete standalone-priced product and flags embedded prices or the wrong price mode', () => {
    expect(checkProduct(base({ attributes: full }), true)).toEqual([]);
    expect(checkProduct(base({ attributes: full, prices: [{ value: { currencyCode: 'EUR', centAmount: 100 }, country: 'DE' }] }), true).join()).toMatch(/embedded prices/);
    expect(checkProduct(base({ attributes: full }, 'Embedded'), true).join()).toMatch(/priceMode must be Standalone/);
  });
});

describe('checkPrices (price sanity above zero, no floor)', () => {
  const keyOf = () => undefined;
  const want = priceDefs();
  const asRes = (d: PriceDef) => ({ key: d.key, sku: d.sku, value: { currencyCode: d.currency, centAmount: d.cents }, country: d.country });
  const channelRes = (d: PriceDef) => ({ ...asRes(d), channel: { id: `id-${d.channelKey}` } });
  const keyOfChannel = (typeId: string, id: string) => (typeId === 'channel' ? id.replace(/^id-/, '') : undefined);
  const have = want.map((d) => (d.channelKey ? channelRes(d) : asRes(d)));

  it('is clean for the complete price set', () => {
    expect(checkPrices(have, want, keyOfChannel)).toEqual([]);
  });

  it('flags a missing price, a wrong value, a zero amount and a pre-release price', () => {
    expect(checkPrices(have.slice(1), want, keyOfChannel).join()).toMatch(/missing/);
    expect(checkPrices(have.map((p, i) => (i === 0 ? { ...p, value: { currencyCode: 'EUR', centAmount: 1 } } : p)), want, keyOfChannel).join()).toMatch(/expected/);
    expect(checkPrices(have.map((p, i) => (i === 0 ? { ...p, value: { currencyCode: 'EUR', centAmount: 0 } } : p)), want, keyOfChannel).join()).toMatch(/above 0/);
    expect(checkPrices([...have, { key: 'x', sku: 'MLV-BP-41099', value: { currencyCode: 'EUR', centAmount: 100 }, country: 'DE' }], want, keyOfChannel).join()).toMatch(/pre-release part must have no price/);
  });

  it('flags a channel price without its channel but accepts any price above zero (no floor)', () => {
    const retail = want.find((d) => d.channelKey && d.currency === 'EUR')!;
    const noChannel = have.map((p) => (p.key === retail.key ? asRes(retail) : p));
    expect(checkPrices(noChannel, want, keyOf).join()).toMatch(/channel none instead of/);
    const cheap = want.map((d) => (d.key === retail.key ? { ...d, cents: 1 } : d));
    expect(checkPrices(cheap.map((d) => (d.channelKey ? channelRes(d) : asRes(d))), cheap, keyOfChannel)).toEqual([]);
  });
});
